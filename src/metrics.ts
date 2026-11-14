import { Effect, Layer, Metric, MetricBoundaries, Option } from 'effect';
import * as Metrics from '@effect/opentelemetry/Metrics';
import * as Resource from '@effect/opentelemetry/Resource';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MetricsConfig } from './config';

/**
 * Metrics are plain Effect `Metric`s held in Effect's global registry. When `METRICS_PORT` is set, {@link MetricsLive}
 * serves them in Prometheus text format on `/metrics`; the exporter reads the registry on each scrape.
 *
 * Names are written the way they should appear in Prometheus. The exporter appends `_total` to counters and ignores
 * units, so unit suffixes (`_seconds`) are part of the name here and `_total` is not.
 */

/** Values for the `outcome` label. */
export type Outcome = 'ok' | 'error';

/** Event types that get a series created at startup. Other types Ring reports appear the first time they are seen. */
const KNOWN_EVENT_TYPES = ['motion', 'ding'];
const OUTCOMES: Outcome[] = ['ok', 'error'];
/** Things the bot calls out to. The S3 and Telegram names match `Uploader.destination`. */
const KNOWN_TARGETS = ['camera_recording', 'telegram', 's3'];

// Incremental counters only go up, which is what makes them Prometheus counters. A non-incremental counter is
// exported as a gauge, which is what `eventsInFlight` wants.
const eventsReceived = Metric.counter('ring_bot_events_received', {
    description: 'Push notifications received from Ring, before any recording is attempted.',
    incremental: true,
});
const eventsHandled = Metric.counter('ring_bot_events_handled', {
    description: 'Events fully handled: recorded and uploaded to every destination (ok), or not (error).',
    incremental: true,
});
const eventsInFlight = Metric.counter('ring_bot_events_in_flight', {
    description: 'Events currently being recorded or uploaded.',
});
const tokenRefreshes = Metric.counter('ring_bot_token_refreshes', {
    description: 'Ring refresh token rotations, by whether the new token was saved to .env.',
    incremental: true,
});
const startTime = Metric.gauge('ring_bot_start_time_seconds', {
    description: 'Unix time the process started.',
});
/** Boundaries in seconds: uploads take a few seconds, recordings take the configured clip length or more. */
const DURATION_BOUNDARIES = MetricBoundaries.fromIterable([0.5, 1, 2.5, 5, 10, 20, 30, 45, 60, 120, 300]);
const downstreamDuration = Metric.histogram(
    'ring_bot_downstream_call_duration_seconds',
    DURATION_BOUNDARIES,
    'Duration of calls to downstream services (camera recording, Telegram, S3), by target and outcome.',
);

// Metric updates are synchronous, so the recorders are plain functions that the Promise-based uploaders can call.

export const recordEventReceived = (camera: string, eventType: string): void =>
    Effect.runSync(
        Metric.update(eventsReceived.pipe(Metric.tagged('camera', camera), Metric.tagged('event_type', eventType)), 1),
    );

export const recordEventHandled = (outcome: Outcome): void =>
    Effect.runSync(Metric.update(eventsHandled.pipe(Metric.tagged('outcome', outcome)), 1));

export const recordEventInFlight = (delta: 1 | -1): void => Effect.runSync(Metric.incrementBy(eventsInFlight, delta));

export const recordTokenRefresh = (outcome: Outcome): void =>
    Effect.runSync(Metric.update(tokenRefreshes.pipe(Metric.tagged('outcome', outcome)), 1));

export const recordDownstreamCall = (target: string, outcome: Outcome, seconds: number): void =>
    Effect.runSync(
        Metric.update(
            downstreamDuration.pipe(Metric.tagged('target', target), Metric.tagged('outcome', outcome)),
            seconds,
        ),
    );

/** Runs `fn` and records its duration and outcome against `target`. Errors are re-thrown. */
export const timedCall = async <T>(target: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
        const result = await fn();
        recordDownstreamCall(target, 'ok', (performance.now() - start) / 1000);
        return result;
    } catch (error) {
        recordDownstreamCall(target, 'error', (performance.now() - start) / 1000);
        throw error;
    }
};

/**
 * Creates every known series at zero, so they exist from the first scrape rather than the first event.
 * Without this, `increase()` over a window that contains a series' first increment can miss it.
 * Reading a metric's value registers it without changing it.
 */
export const initMetrics = (cameraNames: readonly string[]): void => {
    Effect.runSync(
        Effect.all([
            Metric.set(startTime, Date.now() / 1000),
            ...cameraNames.flatMap((camera) =>
                KNOWN_EVENT_TYPES.map((eventType) =>
                    Metric.value(
                        eventsReceived.pipe(Metric.tagged('camera', camera), Metric.tagged('event_type', eventType)),
                    ),
                ),
            ),
            ...OUTCOMES.flatMap((outcome) => [
                Metric.value(eventsHandled.pipe(Metric.tagged('outcome', outcome))),
                Metric.value(tokenRefreshes.pipe(Metric.tagged('outcome', outcome))),
                ...KNOWN_TARGETS.map((target) =>
                    Metric.value(
                        downstreamDuration.pipe(Metric.tagged('target', target), Metric.tagged('outcome', outcome)),
                    ),
                ),
            ]),
            Metric.value(eventsInFlight),
        ]),
    );
};

/** Serves `/metrics` when `METRICS_PORT` is set; does nothing otherwise. */
export const MetricsLive = Layer.unwrapEffect(
    Effect.gen(function* () {
        const config = yield* Effect.serviceOption(MetricsConfig);
        if (Option.isNone(config)) return Layer.empty;
        const { host, port } = config.value;

        // Start the server ourselves: the exporter's own startup swallows listen errors, which would leave a
        // bot that says it serves metrics but doesn't.
        const exporter = new PrometheusExporter({ host, port, withoutScopeInfo: true, preventServerStart: true });
        yield* Effect.tryPromise({
            try: () => exporter.startServer(),
            catch: (error) =>
                new Error(
                    `Could not serve metrics on ${host}:${port} (METRICS_PORT/METRICS_HOST): ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                ),
        });
        yield* Effect.log(`Serving metrics on http://${host}:${port}/metrics`);

        return Metrics.layer(() => exporter).pipe(Layer.provide(Resource.layer({ serviceName: 'ring-telegram-bot' })));
    }),
);

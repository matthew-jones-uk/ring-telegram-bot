import { RingApi, RingCamera } from 'ring-client-api';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { readFile, writeFile, unlink } from 'fs/promises';
import * as path from 'path';
import { Context, Duration, Effect, Layer, Option, Schedule, Stream } from 'effect';
import { NodeRuntime } from '@effect/platform-node';
import {
    TelegramConfig,
    TelegramConfigLive,
    RingConfig,
    RingConfigLive,
    RecordingConfig,
    RecordingConfigLive,
    WatchdogConfig,
    WatchdogConfigLive,
    S3StorageConfig,
    S3StorageConfigLive,
} from './config';
import { streamFromObservable, neverEndingStream } from './stream';
import { UploadManager } from './uploaders/manager';
import { TelegramUploader } from './uploaders/telegram';
import { S3Uploader } from './uploaders/s3';
import type { Uploader } from './uploaders/uploader';

/**
 * Listens for Ring refresh token updates and persists them to the .env file.
 * Runs indefinitely — fails if the token update stream ends or errors.
 */
const refreshTokenListener = (ringApi: RingApi) =>
    neverEndingStream(
        streamFromObservable(ringApi.onRefreshTokenUpdated),
        'Refresh token stream ended unexpectedly',
    ).pipe(
        Stream.runForEach(({ newRefreshToken, oldRefreshToken }) =>
            Effect.gen(function* () {
                yield* Effect.log('Refresh token updated');
                if (!oldRefreshToken) return;
                const currentConfig = yield* Effect.tryPromise(() => readFile('.env'));
                const configStr = currentConfig.toString();
                if (!configStr.includes(oldRefreshToken)) {
                    yield* Effect.fail(new Error('Old refresh token not found in .env'));
                }
                const updatedConfig = configStr.replace(oldRefreshToken, newRefreshToken);
                yield* Effect.tryPromise(() => writeFile('.env', updatedConfig));
                yield* Effect.log('Updated .env with new refresh token');
            }),
        ),
    );

/**
 * Periodically logs camera health information including connectivity,
 * subscription state, and battery status.
 */
const cameraWatchdog = (camera: RingCamera) =>
    Effect.gen(function* () {
        const { intervalMinutes } = yield* WatchdogConfig;
        const status = () => {
            const parts = [
                `offline=${camera.isOffline}`,
                `subscribed=${camera.data.subscribed}`,
                `subscribed_motions=${camera.data.subscribed_motions}`,
                `active_notifications=${camera.activeNotifications.length}`,
                ...(camera.hasBattery ? [`battery=${camera.batteryLevel}%`, `charging=${camera.isCharging}`] : []),
            ];
            return parts.join(', ');
        };
        yield* Effect.log(`[watchdog] ${camera.name}: ${status()}`).pipe(
            Effect.repeat(Schedule.spaced(Duration.minutes(intervalMinutes))),
        );
    });

/**
 * Listens for push notifications on a Ring camera, records video on each event,
 * and uploads to all configured destinations. Events are processed concurrently.
 * Runs a watchdog alongside to periodically log camera health.
 * Runs indefinitely — fails if the notification stream ends or errors.
 */
const cameraListener = (camera: RingCamera) =>
    Effect.gen(function* () {
        const recording = yield* RecordingConfig;
        const uploadManager = yield* UploadManagerService;

        const notifications = Effect.log(`Subscribing to notifications for ${camera.name}`).pipe(
            Effect.andThen(
                neverEndingStream(
                    streamFromObservable(camera.onNewNotification),
                    `Notification stream for ${camera.name} ended unexpectedly`,
                ).pipe(
                    Stream.mapEffect(
                        (notification) =>
                            Effect.gen(function* () {
                                const { ding } = notification.data.event;
                                const timestamp = new Date().toISOString();
                                const filename = `${timestamp}-${camera.name}-${ding.subtype}.mp4`;
                                yield* Effect.log(
                                    `${ding.detection_type} event of ${ding.subtype} on ${camera.name}. Recording to ${filename}`,
                                );
                                const recordingFile = path.join(recording.directory, filename);
                                yield* Effect.tryPromise(() =>
                                    camera.recordToFile(recordingFile, recording.snippetDuration),
                                );
                                const results = yield* Effect.tryPromise(() =>
                                    uploadManager.uploadToAll(recordingFile, filename),
                                );
                                yield* Effect.forEach(
                                    results,
                                    (result) =>
                                        result.success
                                            ? Effect.log(
                                                  `Uploaded to ${result.destination}${
                                                      result.url ? `: ${result.url}` : ''
                                                  }`,
                                              )
                                            : Effect.log(
                                                  `Failed to upload to ${result.destination}: ${
                                                      result.error?.message ?? 'unknown error'
                                                  }`,
                                              ),
                                    { discard: true },
                                );
                                if (recording.cleanupAfterUpload && results.every((r) => r.success)) {
                                    yield* Effect.tryPromise(() => unlink(recordingFile)).pipe(
                                        Effect.tap(() => Effect.log(`Cleaned up local file: ${filename}`)),
                                        Effect.catchAll((e) => Effect.log(`Failed to clean up ${filename}: ${e}`)),
                                    );
                                }
                            }),
                        { concurrency: 'unbounded' },
                    ),
                    Stream.runDrain,
                ),
            ),
        );

        yield* Effect.all([notifications, cameraWatchdog(camera)], { concurrency: 'unbounded' });
    });

// --- Services ---

/** UploadManager as a service — wires Telegram and/or S3 uploaders from config. */
class UploadManagerService extends Context.Tag('UploadManagerService')<UploadManagerService, UploadManager>() {}

const UploadManagerLive = Layer.effect(
    UploadManagerService,
    Effect.gen(function* () {
        const telegramOpt = yield* Effect.serviceOption(TelegramConfig);
        const s3Opt = yield* Effect.serviceOption(S3StorageConfig);
        const uploaders: Uploader[] = [];

        if (Option.isSome(telegramOpt)) {
            const { botToken, chatIds } = telegramOpt.value;
            uploaders.push(new TelegramUploader(new TelegramBot(botToken, { polling: false }), chatIds));
            yield* Effect.log('Telegram uploader configured');
        }

        if (Option.isSome(s3Opt)) {
            uploaders.push(new S3Uploader(s3Opt.value));
            yield* Effect.log(`S3 uploader configured for bucket: ${s3Opt.value.bucket}`);
        }

        if (uploaders.length === 0) {
            return yield* Effect.fail(new Error('No upload destinations configured — set Telegram or S3 env vars'));
        }

        const manager = new UploadManager(uploaders);
        yield* Effect.tryPromise(() => manager.healthCheckAll());
        yield* Effect.log('All upload destinations passed health checks');
        return manager;
    }),
);

/** RingApi instance as a service. */
class RingApiService extends Context.Tag('RingApiService')<RingApiService, RingApi>() {}

const RingApiLive = Layer.effect(
    RingApiService,
    Effect.gen(function* () {
        const { refreshToken } = yield* RingConfig;
        return new RingApi({
            debug: true,
            avoidSnapshotBatteryDrain: true,
            refreshToken,
        });
    }),
);

// --- Main ---

/**
 * Main program effect. Loads config, initialises services,
 * then runs all listeners concurrently. Crashes on the first stream failure.
 */
const program = Effect.gen(function* () {
    const ringApi = yield* RingApiService;

    const cameras = yield* Effect.tryPromise(() => ringApi.getCameras());
    yield* Effect.log(`Got total of ${cameras.length} camera(s)`);

    for (const camera of cameras) {
        yield* Effect.log(`Found ${camera.deviceType} called ${camera.name}`);
    }

    yield* Effect.log('Listening for motion events...');

    yield* Effect.all([refreshTokenListener(ringApi), ...cameras.map((camera) => cameraListener(camera))], {
        concurrency: 'unbounded',
    });
});

const ConfigLive = Layer.mergeAll(
    TelegramConfigLive,
    RingConfigLive,
    RecordingConfigLive,
    WatchdogConfigLive,
    S3StorageConfigLive,
);
const ServicesLive = Layer.mergeAll(UploadManagerLive, RingApiLive).pipe(Layer.provide(ConfigLive));
const AppLive = Layer.merge(ConfigLive, ServicesLive);

NodeRuntime.runMain(program.pipe(Effect.provide(AppLive)));

import { RingApi, RingCamera } from 'ring-client-api';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import { Context, Duration, Effect, Layer, Schedule, Stream } from 'effect';
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
} from './config';
import { streamFromObservable, neverEndingStream } from './stream';

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
 * Sends a recorded video file to all configured Telegram chats.
 * Errors per chat are logged and do not interrupt sending to other chats.
 */
const sendRecording = (recordingFile: string, filename: string, chatIds: string[], bot: TelegramBot) =>
    Effect.forEach(
        chatIds,
        (chatId) =>
            Effect.tryPromise(() =>
                bot.sendVideo(chatId, recordingFile, {}, { filename, contentType: 'video/mp4' }),
            ).pipe(Effect.catchAll((e) => Effect.log(`Error sending ${filename} to chat ${chatId}: ${e}`))),
        { discard: true },
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
 * and sends the recording to Telegram. Events are processed concurrently.
 * Runs a watchdog alongside to periodically log camera health.
 * Runs indefinitely — fails if the notification stream ends or errors.
 */
const cameraListener = (camera: RingCamera) =>
    Effect.gen(function* () {
        const { chatIds } = yield* TelegramConfig;
        const recording = yield* RecordingConfig;
        const bot = yield* TelegramBotService;

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
                                yield* sendRecording(recordingFile, filename, chatIds, bot);
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

/** TelegramBot instance as a service. */
class TelegramBotService extends Context.Tag('TelegramBotService')<TelegramBotService, TelegramBot>() {}

const TelegramBotLive = Layer.effect(
    TelegramBotService,
    Effect.gen(function* () {
        const { botToken } = yield* TelegramConfig;
        return new TelegramBot(botToken, { polling: false });
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
 * Main program effect. Loads config, initialises the Ring API and Telegram bot,
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

const ConfigLive = Layer.mergeAll(TelegramConfigLive, RingConfigLive, RecordingConfigLive, WatchdogConfigLive);
const ServicesLive = Layer.mergeAll(TelegramBotLive, RingApiLive).pipe(Layer.provide(ConfigLive));
const AppLive = Layer.merge(ConfigLive, ServicesLive);

NodeRuntime.runMain(program.pipe(Effect.provide(AppLive)));

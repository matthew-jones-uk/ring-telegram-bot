import { RingApi, RingCamera } from 'ring-client-api';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import { Effect, Stream } from 'effect';
import { NodeRuntime } from '@effect/platform-node';
import { telegramConfig, ringConfig, recordingConfig } from './config';
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
                const updatedConfig = currentConfig.toString().replace(oldRefreshToken, newRefreshToken);
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
 * Listens for push notifications on a Ring camera, records video on each event,
 * and sends the recording to Telegram. Events are processed concurrently.
 * Runs indefinitely — fails if the notification stream ends or errors.
 */
const cameraListener = (
    camera: RingCamera,
    recording: { snippetDuration: number; directory: string },
    chatIds: string[],
    bot: TelegramBot,
) =>
    neverEndingStream(
        streamFromObservable(camera.onNewNotification),
        `Notification stream for ${camera.name} ended unexpectedly`,
    ).pipe(
        Stream.mapEffect(
            ({ ding, subtype }) =>
                Effect.gen(function* () {
                    const timestamp = new Date().toISOString();
                    const filename = `${timestamp}-${camera.name}-${subtype}.mp4`;
                    yield* Effect.log(
                        `${ding.detection_type} event of ${subtype} on ${camera.name}. Recording to ${filename}`,
                    );
                    const recordingFile = path.join(recording.directory, filename);
                    yield* Effect.tryPromise(() => camera.recordToFile(recordingFile, recording.snippetDuration));
                    yield* sendRecording(recordingFile, filename, chatIds, bot);
                }),
            { concurrency: 'unbounded' },
        ),
        Stream.runDrain,
    );

// --- Main ---

/**
 * Main program effect. Loads config, initialises the Ring API and Telegram bot,
 * then runs all listeners concurrently. Crashes on the first stream failure.
 */
const program = Effect.gen(function* () {
    const telegram = yield* telegramConfig;
    const ring = yield* ringConfig;
    const recording = yield* recordingConfig;

    const bot = new TelegramBot(telegram.botToken, { polling: false });
    const ringApi = new RingApi({
        debug: true,
        avoidSnapshotBatteryDrain: true,
        refreshToken: ring.refreshToken,
    });

    const cameras = yield* Effect.tryPromise(() => ringApi.getCameras());
    yield* Effect.log(`Setup total of ${cameras.length} camera(s)`);

    for (const camera of cameras) {
        yield* Effect.log(`Found ${camera.deviceType} called ${camera.name}`);
    }

    yield* Effect.log('Listening for motion events...');

    yield* Effect.all(
        [
            refreshTokenListener(ringApi),
            ...cameras.map((camera) => cameraListener(camera, recording, telegram.chatIds, bot)),
        ],
        { concurrency: 'unbounded' },
    );
});

NodeRuntime.runMain(program);

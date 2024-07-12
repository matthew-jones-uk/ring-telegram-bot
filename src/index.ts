import { RingApi } from 'ring-client-api';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import { getRecordingConfig, getRingConfig, getTelegramConfig } from './config';

const setupTelegramBot = (telegramConfig: TelegramConfig): TelegramBot =>
    new TelegramBot(telegramConfig.botToken, { polling: false });

const setupRingApi = (ringConfig: RingConfig): RingApi => {
    const ringApi = new RingApi({
        debug: true,
        avoidSnapshotBatteryDrain: true,
        ...ringConfig,
    });

    ringApi.onRefreshTokenUpdated.subscribe(async ({ newRefreshToken, oldRefreshToken }) => {
        console.log('Refresh Token Updated: ', newRefreshToken);

        if (!oldRefreshToken) {
            return;
        }

        // TODO: redo this to properly support env variables and to more gracefully handle token updates
        const currentConfig = await readFile('.env');
        const updatedConfig = currentConfig.toString().replace(oldRefreshToken, newRefreshToken);

        await writeFile('.env', updatedConfig);
    });

    return ringApi;
};

const sendRecording = async (recordingPath: string, chatIds: string[], telegramBot: TelegramBot) => {
    const filename = path.basename(recordingPath);
    const fileOptions = { filename, contentType: 'video/mp4' };
    for (const chatId of chatIds) {
        try {
            await telegramBot.sendVideo(chatId, recordingPath, {}, fileOptions);
        } catch (e) {
            console.error(`Error sending ${filename} to chat ${chatId}`, e);
        }
    }
};

const setup = async () => {
    const telegramConfig = getTelegramConfig();
    const ringConfig = getRingConfig();
    const recordingConfig = getRecordingConfig();

    const telegramBot = setupTelegramBot(telegramConfig);
    const ringApi = setupRingApi(ringConfig);

    const allCameras = await ringApi.getCameras();

    for (const camera of allCameras) {
        console.log(`Found ${camera.deviceType} called ${camera.name}`);

        camera.onNewNotification.subscribe(async ({ ding, subtype }) => {
            const timestamp = new Date().toISOString();
            const filename = `${timestamp}-${camera.name}-${subtype}.mp4`;
            console.log(`${ding.detection_type} event detected on ${camera.name}. Recording to ${filename}`);
            const recordingFile = path.join(recordingConfig.directory, filename);
            await camera.recordToFile(recordingFile, recordingConfig.snippetDuration);
            sendRecording(recordingFile, telegramConfig.chatIds, telegramBot);
        });
    }

    console.log('Setup total of ' + allCameras.length + ' camera(s)');
    console.log('Listening for motion events...');
};

console.log('Starting...');
setup();

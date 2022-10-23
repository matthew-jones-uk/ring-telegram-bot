import { RingApi } from 'ring-client-api';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { readFile, writeFile } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { getRecordingConfig, getRingConfig, getTelegramConfig } from './config.js';

const setupTelegramBot = (telegramConfig: TelegramConfig): TelegramBot =>
    new TelegramBot(telegramConfig.botToken, { polling: true });

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

        const currentConfig = await promisify(readFile)('.env'),
            updatedConfig = currentConfig.toString().replace(oldRefreshToken, newRefreshToken);

        await promisify(writeFile)('.env', updatedConfig);
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
            if (ding.detection_type !== 'motion') return; // We only care about motion events
            const timestamp = new Date().toISOString();
            const filename = `${timestamp}-${camera.name}-${subtype}.mp4`;
            console.log(`Motion event detected on ${camera.name}. Recording to ${filename}`);
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

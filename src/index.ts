import { RingApi } from 'ring-client-api';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { readFile, writeFile } from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const recordingDir = process.env.RECORDING_DIR || '/tmp';
const recordingDurationString = process.env.RECORDING_DURATION || 30;
const refreshToken = process.env.RING_REFRESH_TOKEN;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

if (isNaN(+recordingDurationString)) {
    console.error('Invalid recording duration (must be number)');
    process.exit(1);
}

const recordingDuration = +recordingDurationString;

if (!refreshToken) {
    console.error('No RING_REFRESH_TOKEN set');
    process.exit(1);
}

if (!telegramBotToken) {
    console.error('No TELEGRAM_BOT_TOKEN set');
    process.exit(1);
}

if (!process.env.TELEGRAM_BOT_CHATS) {
    console.error('No TELEGRAM_BOT_CHATS set');
    process.exit(1);
}

const ringApi = new RingApi({
    refreshToken,
    debug: true,
    avoidSnapshotBatteryDrain: true,
});

const telegramBot = new TelegramBot(telegramBotToken, { polling: true });
const telegramChats = process.env.TELEGRAM_BOT_CHATS.split(' ');

const sendRecording = async (recordingPath: string) => {
    const fileOptions = { filename: path.basename(recordingPath), contentType: 'video/mp4' };
    telegramChats.forEach((chatId) => {
        telegramBot.sendVideo(chatId, recordingPath, {}, fileOptions).then((result) => {
            console.log(result);
        });
    });
};

ringApi.onRefreshTokenUpdated.subscribe(async ({ newRefreshToken, oldRefreshToken }) => {
    console.log('Refresh Token Updated: ', newRefreshToken);

    if (!oldRefreshToken) {
        return;
    }

    const currentConfig = await promisify(readFile)('.env'),
        updatedConfig = currentConfig.toString().replace(oldRefreshToken, newRefreshToken);

    await promisify(writeFile)('.env', updatedConfig);
});

const allCameras = await ringApi.getCameras();

if (allCameras.length) {
    for (const camera of allCameras) {
        console.log(`Found ${camera.deviceType} called ${camera.name}`);
        camera.onNewNotification.subscribe(async ({ ding, subtype }) => {
            if (ding.detection_type !== 'motion') return; // We only care about motion events
            const timestamp = new Date().toISOString();
            const filename = `${timestamp}-${camera.name}-${subtype}.mp4`;
            console.log(`Motion event detected on ${camera.name}. Recording to ${filename}`);
            const recordingFile = path.join(recordingDir, filename);
            await camera.recordToFile(recordingFile, recordingDuration);
            sendRecording(recordingFile);
        });
    }
}

console.log('Listening...');

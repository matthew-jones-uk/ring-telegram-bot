import { RingApi } from 'ring-client-api';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { readFile, writeFile } from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const recordingDir = process.env.RECORDING_DIR;
const recordingDuration = process.env.RECORDING_DURATION || 15;

const ringApi = new RingApi({
    refreshToken: process.env.RING_REFRESH_TOKEN,

    cameraStatusPollingSeconds: 20,
    cameraDingsPollingSeconds: 0.5,
    debug: true,
    avoidSnapshotBatteryDrain: true,
});

const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const telegramChats = process.env.TELEGRAM_BOT_CHATS.split(' ');

async function sendRecording(recordingFile) {
    const fileOptions = { filename: path.basename(recordingFile), contentType: 'video/mp4' };
    telegramChats.forEach(chatId => {
        telegramBot.sendVideo(chatId, recordingFile, {}, fileOptions).then((result) => {
            console.log(result);
        });
    });
}

ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
        console.log('Refresh Token Updated: ', newRefreshToken)

        if (!oldRefreshToken) {
            return
        }

        const currentConfig = await promisify(readFile)('.env'),
            updatedConfig = currentConfig
                .toString()
                .replace(oldRefreshToken, newRefreshToken)

        await promisify(writeFile)('.env', updatedConfig)
    }
)

const allCameras = await ringApi.getCameras();

if (allCameras.length) {
    for (const camera of allCameras) {
        console.log(`Found ${camera.deviceType} called ${camera.name}`);
        camera.onNewDing.subscribe(async (ding) => {
            if (ding.kind !== 'motion') return; // only interested in motion dings (when a doorbell ding occurs we should have already detected motion?)
            const timestamp = new Date().toISOString();
            const filename = `${timestamp}-${ding.kind}.mp4`;
            console.log(`Motion event detected on ${camera.name}. Recording to ${filename}`);
            const recordingFile = path.join(recordingDir, filename);
            await camera.recordToFile(recordingFile, recordingDuration);
            sendRecording(recordingFile);
        })
    }
}

console.log("Listening...");

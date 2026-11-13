import TelegramBot from 'node-telegram-bot-api';
import { Uploader, UploadResult } from './uploader';

export class TelegramUploader implements Uploader {
    readonly destination = 'telegram';

    constructor(private bot: TelegramBot, private chatIds: string[]) {}

    async healthCheck(): Promise<void> {
        await this.bot.getMe();
    }

    async upload(filePath: string, filename: string): Promise<UploadResult> {
        const fileOptions = { filename, contentType: 'video/mp4' };
        const failures: { chatId: string; error: Error }[] = [];

        for (const chatId of this.chatIds) {
            try {
                await this.bot.sendVideo(chatId, filePath, {}, fileOptions);
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.error(`Error sending ${filename} to chat ${chatId}:`, error.message);
                failures.push({ chatId, error });
            }
        }

        // Any failed chat fails the upload, so a recording is never cleaned up while a chat is still missing it.
        if (failures.length > 0) {
            const details = failures.map((f) => `${f.chatId} (${f.error.message})`).join('; ');
            return {
                success: false,
                destination: this.destination,
                error: new Error(
                    `Failed to send to ${failures.length} of ${this.chatIds.length} Telegram chat(s): ${details}`,
                ),
            };
        }

        return {
            success: true,
            destination: 'telegram',
        };
    }
}

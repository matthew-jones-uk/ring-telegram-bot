import TelegramBot from 'node-telegram-bot-api';
import { Uploader, UploadResult } from './uploader';

export class TelegramUploader implements Uploader {
    constructor(
        private bot: TelegramBot,
        private chatIds: string[],
    ) {}

    async healthCheck(): Promise<void> {
        await this.bot.getMe();
    }

    async upload(filePath: string, filename: string): Promise<UploadResult> {
        const fileOptions = { filename, contentType: 'video/mp4' };
        const errors: Error[] = [];

        for (const chatId of this.chatIds) {
            try {
                await this.bot.sendVideo(chatId, filePath, {}, fileOptions);
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.error(`Error sending ${filename} to chat ${chatId}:`, error.message);
                errors.push(error);
            }
        }

        if (errors.length === this.chatIds.length) {
            return {
                success: false,
                destination: 'telegram',
                error: new Error(`Failed to send to all ${this.chatIds.length} Telegram chat(s)`),
            };
        }

        return {
            success: true,
            destination: 'telegram',
        };
    }
}

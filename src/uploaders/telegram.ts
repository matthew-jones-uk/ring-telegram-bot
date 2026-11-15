import type { Api } from 'node-telegram-bot-api';
import { fromPath } from 'node-telegram-bot-api/node';
import { Uploader, UploadResult } from './uploader';

export class TelegramUploader implements Uploader {
    readonly destination = 'telegram';

    constructor(private api: Api, private chatIds: string[]) {}

    async healthCheck(): Promise<void> {
        await this.api.getMe();
    }

    async upload(filePath: string, filename: string): Promise<UploadResult> {
        const failures: { chatId: string; error: Error }[] = [];

        for (const chatId of this.chatIds) {
            try {
                // fromPath streams from disk and reopens the file if the transport retries
                const video = await fromPath(filePath, { filename, contentType: 'video/mp4' });
                await this.api.sendVideo({ chat_id: chatId, video });
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

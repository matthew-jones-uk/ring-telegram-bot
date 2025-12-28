import { Uploader, UploadResult } from './uploader';

export class UploadManager {
    constructor(private uploaders: Uploader[]) {}

    async uploadToAll(filePath: string, filename: string): Promise<UploadResult[]> {
        if (this.uploaders.length === 0) {
            console.warn('No uploaders configured');
            return [];
        }

        const results = await Promise.allSettled(
            this.uploaders.map((uploader) => uploader.upload(filePath, filename)),
        );

        return results.map((result) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    success: false,
                    destination: 'unknown',
                    error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
                };
            }
        });
    }
}

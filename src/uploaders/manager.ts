import { Uploader, UploadResult } from './uploader';

export class UploadManager {
    constructor(private uploaders: Uploader[]) {}

    async healthCheckAll(): Promise<void> {
        const results = await Promise.allSettled(this.uploaders.map((u) => u.healthCheck()));
        const failures = results
            .map((r, i) => (r.status === 'rejected' ? { uploader: this.uploaders[i], error: r.reason } : null))
            .filter((r) => r !== null);
        if (failures.length > 0) {
            const messages = failures.map((f) => {
                const detail = f.error instanceof Error ? f.error.message : String(f.error);
                return `${f.uploader.destination}: ${detail}`;
            });
            throw new Error(`Health check failed — ${messages.join('; ')}`);
        }
    }

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

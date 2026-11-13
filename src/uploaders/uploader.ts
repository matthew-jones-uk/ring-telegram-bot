export type UploadResult = {
    success: boolean;
    destination: string;
    url?: string;
    error?: Error;
};

export interface Uploader {
    readonly destination: string;
    /**
     * Uploads a finished recording.
     * @param filename Flat file name, for destinations that show a name (e.g. Telegram).
     * @param key Object key, for destinations that store by path (e.g. S3). May contain `/` separators.
     */
    upload(filePath: string, filename: string, key: string): Promise<UploadResult>;
    healthCheck(): Promise<void>;
}

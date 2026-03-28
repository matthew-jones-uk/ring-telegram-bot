export type UploadResult = {
    success: boolean;
    destination: string;
    url?: string;
    error?: Error;
};

export interface Uploader {
    upload(filePath: string, filename: string): Promise<UploadResult>;
    healthCheck(): Promise<void>;
}

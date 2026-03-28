import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Uploader, UploadResult } from './uploader';

export type S3Config = {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicUrl?: string;
};

export class S3Uploader implements Uploader {
    readonly destination = 's3';
    private s3Client: S3Client;

    constructor(private config: S3Config) {
        this.s3Client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
    }

    async healthCheck(): Promise<void> {
        try {
            await this.s3Client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
        } catch (error) {
            throw new Error(`S3 bucket "${this.config.bucket}" is not accessible`, { cause: error });
        }
    }

    async upload(filePath: string, filename: string): Promise<UploadResult> {
        try {
            const fileStream = createReadStream(filePath);
            const fileStats = await stat(filePath);

            const command = new PutObjectCommand({
                Bucket: this.config.bucket,
                Key: filename,
                Body: fileStream,
                ContentType: 'video/mp4',
                ContentLength: fileStats.size,
            });

            await this.s3Client.send(command);

            const url = this.config.publicUrl
                ? `${this.config.publicUrl}/${filename}`
                : `${this.config.endpoint}/${this.config.bucket}/${filename}`;

            return {
                success: true,
                destination: this.destination,
                url,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error(`Error uploading ${filename} to S3:`, err.message);
            return {
                success: false,
                destination: this.destination,
                error: err,
            };
        }
    }
}

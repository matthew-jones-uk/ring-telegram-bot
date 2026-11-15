import type { RingCamera } from 'ring-client-api';

/** Milliseconds since `recordClip` was called. */
export type ClipTimings = {
    /** Ring accepted the live-view request and returned a session. */
    sessionMs: number;
    /** The camera answered, the SDP was handed to ffmpeg and ffmpeg was spawned. */
    transcodingStartedMs: number;
    /** First video RTP packet arrived from the camera. Undefined if none arrived. */
    firstVideoMs: number | undefined;
};

/**
 * Records a clip the way `RingCamera.recordToFile` does (open a live call, transcode it with ffmpeg, wait for the
 * call to end), but exposes how long each stage took and writes the MP4 index at the front of the file
 * (`-movflags +faststart`) so players, including Telegram, can start playback before the whole file has loaded.
 */
export const recordClip = async (camera: RingCamera, outputPath: string, duration: number): Promise<ClipTimings> => {
    const start = performance.now();
    const elapsed = () => performance.now() - start;

    const liveCall = await camera.startLiveCall();
    const sessionMs = elapsed();

    let firstVideoMs: number | undefined;
    const videoSub = liveCall.onVideoRtp.subscribe(() => {
        firstVideoMs ??= elapsed();
    });

    try {
        await liveCall.startTranscoding({
            output: ['-t', duration.toString(), '-movflags', '+faststart', outputPath],
        });
        const transcodingStartedMs = elapsed();

        await new Promise<void>((resolve) => {
            liveCall.onCallEnded.subscribe(() => resolve());
        });
        return { sessionMs, transcodingStartedMs, firstVideoMs };
    } finally {
        videoSub.unsubscribe();
    }
};

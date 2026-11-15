import type { RingCamera } from 'ring-client-api';

/**
 * Records a clip the way `RingCamera.recordToFile` does (open a live call, transcode it with ffmpeg, wait for the
 * call to end), but writes the MP4 index at the front of the file (`-movflags +faststart`) so players, including
 * Telegram, can start playback before the whole file has loaded. `recordToFile` doesn't let us pass ffmpeg arguments.
 */
export const recordClip = async (camera: RingCamera, outputPath: string, duration: number): Promise<void> => {
    const liveCall = await camera.startLiveCall();
    await liveCall.startTranscoding({
        output: ['-t', duration.toString(), '-movflags', '+faststart', outputPath],
    });
    await new Promise<void>((resolve) => {
        liveCall.onCallEnded.subscribe(() => resolve());
    });
};

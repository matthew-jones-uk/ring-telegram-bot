/**
 * Builds the filename for a recording, e.g. `2026-11-13T21-48-55.507Z-Front_Door-motion.mp4`.
 *
 * The name is used as the local file name, the S3 object key and the end of the logged URL, so it avoids
 * characters that are awkward in all three: colons in the timestamp become dashes, and whitespace and path
 * separators in the camera name become underscores.
 */
export const recordingFilename = (cameraName: string, subtype: string, date: Date = new Date()): string => {
    const timestamp = date.toISOString().replace(/:/g, '-');
    const safeCameraName = cameraName.replace(/[\s/\\]+/g, '_');
    return `${timestamp}-${safeCameraName}-${subtype}.mp4`;
};

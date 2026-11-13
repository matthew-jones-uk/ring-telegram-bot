/**
 * Formats a date as an ISO 8601 basic-format UTC timestamp, e.g. `20261113T214855.507Z`.
 *
 * The basic format has no colons or dashes, so it is safe in file names on every platform and in URLs
 * without percent-encoding, and it sorts chronologically as plain text.
 */
export const recordingTimestamp = (date: Date): string => date.toISOString().replace(/[-:]/g, '');

/**
 * Builds the file name for a recording, e.g. `20261113T214855.507Z-Front_Door-motion.mp4`.
 *
 * It is used as the local file name and the name Telegram shows, so whitespace and path separators in the
 * camera name become underscores.
 */
export const recordingFilename = (cameraName: string, subtype: string, date: Date = new Date()): string => {
    const safeCameraName = cameraName.replace(/[\s/\\]+/g, '_');
    return `${recordingTimestamp(date)}-${safeCameraName}-${subtype}.mp4`;
};

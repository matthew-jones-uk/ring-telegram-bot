/**
 * Formats a date as an ISO 8601 basic-format UTC timestamp, e.g. `20261113T214855.507Z`.
 *
 * The basic format has no colons or dashes, so it is safe in file names on every platform and in URLs
 * without percent-encoding, and it sorts chronologically as plain text.
 */
export const recordingTimestamp = (date: Date): string => date.toISOString().replace(/[-:]/g, '');

/** Replaces whitespace and path separators with underscores so a value is safe inside a file name or key segment. */
const sanitize = (value: string): string => {
    const safe = value.replace(/[\s/\\]+/g, '_');
    // A segment made only of dots would be a relative path component.
    return /^\.*$/.test(safe) ? '_' : safe;
};

/**
 * Builds the file name for a recording, e.g. `20261113T214855.507Z-Front_Door-motion.mp4`.
 *
 * It is used as the local file name and the name Telegram shows, so it is always flat and unique.
 */
export const recordingFilename = (cameraName: string, subtype: string, date: Date = new Date()): string =>
    `${recordingTimestamp(date)}-${sanitize(cameraName)}-${sanitize(subtype)}.mp4`;

/** Values that can be used in the object key template, as `{name}`. */
const PLACEHOLDERS = ['timestamp', 'date', 'time', 'camera', 'subtype', 'duration'] as const;
type Placeholder = typeof PLACEHOLDERS[number];

/** Default object key template, e.g. `2026-11-13/214855.507-Front_Door-motion-30s.mp4`. */
export const DEFAULT_KEY_TEMPLATE = '{date}/{time}-{camera}-{subtype}-{duration}s';

const PLACEHOLDER_PATTERN = /\{([^{}]*)\}/g;
const LITERAL_PATTERN = /^[A-Za-z0-9._\-/]*$/;

/**
 * Checks an object key template. Returns an error message, or undefined if the template is valid.
 *
 * Placeholders are `{timestamp}`, `{date}`, `{time}`, `{camera}`, `{subtype}` and `{duration}`. Everything else
 * must be letters, digits, `.`, `_`, `-` or `/`. The template must include `{timestamp}`, or both `{date}` and
 * `{time}`, so that recordings made close together don't overwrite each other.
 */
export const validateKeyTemplate = (template: string): string | undefined => {
    if (template.trim() === '') return 'template must not be empty';

    const used = [...template.matchAll(PLACEHOLDER_PATTERN)].map((m) => m[1]);
    const unknown = used.filter((name) => !(PLACEHOLDERS as readonly string[]).includes(name));
    if (unknown.length > 0) {
        return `unknown placeholder(s) ${unknown.map((n) => `{${n}}`).join(', ')}; allowed: ${PLACEHOLDERS.map(
            (n) => `{${n}}`,
        ).join(', ')}`;
    }

    const literal = template.replace(PLACEHOLDER_PATTERN, '');
    if (!LITERAL_PATTERN.test(literal)) {
        return 'only letters, digits, ".", "_", "-" and "/" are allowed outside {placeholders}';
    }

    if (template.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
        return 'path segments must not be empty, ".", or ".."';
    }

    const has = (name: Placeholder) => used.includes(name);
    if (!has('timestamp') && !(has('date') && has('time'))) {
        return 'template must include {timestamp}, or both {date} and {time}, so recordings get unique names';
    }
    return undefined;
};

export type RecordingKeyInput = {
    cameraName: string;
    subtype: string;
    durationSeconds: number;
    date?: Date;
};

/**
 * Renders an object key template (see {@link validateKeyTemplate}) and appends `.mp4`.
 * Dates and times are UTC. `{duration}` is the requested recording length in seconds.
 */
export const recordingKey = (template: string, input: RecordingKeyInput): string => {
    const date = input.date ?? new Date();
    const iso = date.toISOString();
    const values: Record<Placeholder, string> = {
        timestamp: recordingTimestamp(date),
        date: iso.slice(0, 10),
        time: iso.slice(11, 23).replace(/:/g, ''),
        camera: sanitize(input.cameraName),
        subtype: sanitize(input.subtype),
        duration: String(input.durationSeconds),
    };
    return `${template.replace(PLACEHOLDER_PATTERN, (_, name: Placeholder) => values[name])}.mp4`;
};

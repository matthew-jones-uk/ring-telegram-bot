const DEFAULT_SNIPPET_DURATION = 30;
const DEFAULT_RECORDING_DIR = '/tmp';

export const getTelegramConfig = (): TelegramConfig => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChats = process.env.TELEGRAM_BOT_CHATS;

    if (!botToken) {
        throw new Error('No TELEGRAM_BOT_TOKEN set');
    }

    if (!telegramChats) {
        throw new Error('No TELEGRAM_BOT_CHATS set');
    }

    return {
        botToken,
        chatIds: telegramChats.split(' '),
    };
};

export const getRingConfig = (): RingConfig => {
    const refreshToken = process.env.RING_REFRESH_TOKEN;

    if (!refreshToken) {
        throw new Error('No RING_REFRESH_TOKEN set');
    }

    return {
        refreshToken,
    };
};

export const getRecordingConfig = (): RecordingConfig => {
    const duration = process.env.RECORDING_DURATION || DEFAULT_SNIPPET_DURATION;
    const directory = process.env.RECORDING_DIR || DEFAULT_RECORDING_DIR;

    if (isNaN(+duration)) {
        throw new Error('Invalid RECORDING_DURATION (must be number)');
    }

    return {
        snippetDuration: +duration,
        directory,
    };
};

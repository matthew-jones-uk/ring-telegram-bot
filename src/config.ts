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
    const directory = process.env.RECORDING_DIR || DEFAULT_RECORDING_DIR;

    return {
        directory,
    };
};

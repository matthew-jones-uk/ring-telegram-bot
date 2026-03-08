import { Config } from 'effect';

export const telegramConfig = Config.all({
    botToken: Config.string('TELEGRAM_BOT_TOKEN'),
    chatIds: Config.map(Config.string('TELEGRAM_BOT_CHATS'), (s) => s.split(' ')),
});

export const ringConfig = Config.all({
    refreshToken: Config.string('RING_REFRESH_TOKEN'),
});

export const recordingConfig = Config.all({
    snippetDuration: Config.integer('RECORDING_DURATION').pipe(Config.withDefault(30)),
    directory: Config.string('RECORDING_DIR').pipe(Config.withDefault('/tmp')),
});

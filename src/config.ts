import { Config, Context, Layer } from 'effect';

/** Telegram bot token and chat IDs to send recordings to. */
export class TelegramConfig extends Context.Tag('TelegramConfig')<
    TelegramConfig,
    { readonly botToken: string; readonly chatIds: string[] }
>() {}

export const TelegramConfigLive = Layer.effect(
    TelegramConfig,
    Config.all({
        botToken: Config.string('TELEGRAM_BOT_TOKEN'),
        chatIds: Config.map(Config.string('TELEGRAM_BOT_CHATS'), (s) => s.split(' ')),
    }),
);

/** Ring API refresh token. */
export class RingConfig extends Context.Tag('RingConfig')<RingConfig, { readonly refreshToken: string }>() {}

export const RingConfigLive = Layer.effect(
    RingConfig,
    Config.all({
        refreshToken: Config.string('RING_REFRESH_TOKEN'),
    }),
);

/** Recording snippet duration and output directory. */
export class RecordingConfig extends Context.Tag('RecordingConfig')<
    RecordingConfig,
    { readonly snippetDuration: number; readonly directory: string }
>() {}

export const RecordingConfigLive = Layer.effect(
    RecordingConfig,
    Config.all({
        snippetDuration: Config.integer('RECORDING_DURATION').pipe(Config.withDefault(30)),
        directory: Config.string('RECORDING_DIR').pipe(Config.withDefault('/tmp')),
    }),
);

/** Watchdog health check interval. */
export class WatchdogConfig extends Context.Tag('WatchdogConfig')<
    WatchdogConfig,
    { readonly intervalMinutes: number }
>() {}

export const WatchdogConfigLive = Layer.effect(
    WatchdogConfig,
    Config.all({
        intervalMinutes: Config.integer('WATCHDOG_INTERVAL_MINUTES').pipe(Config.withDefault(30)),
    }),
);

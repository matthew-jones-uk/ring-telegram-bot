import { Config, Context, Effect, Layer, Option } from 'effect';
import type { S3Config } from './uploaders/s3';

/** Telegram bot token and chat IDs to send recordings to. Optional — not needed for S3-only deployments. */
export class TelegramConfig extends Context.Tag('TelegramConfig')<
    TelegramConfig,
    { readonly botToken: string; readonly chatIds: string[] }
>() {}

export const TelegramConfigLive = Layer.unwrapEffect(
    Config.option(
        Config.all({
            botToken: Config.string('TELEGRAM_BOT_TOKEN'),
            chatIds: Config.map(Config.string('TELEGRAM_BOT_CHATS'), (s) => s.split(' ')),
        }),
    ).pipe(
        Effect.map(
            Option.match({
                onNone: () => Layer.empty,
                onSome: (value) => Layer.succeed(TelegramConfig, value),
            }),
        ),
    ),
);

/** Ring API refresh token. */
export class RingConfig extends Context.Tag('RingConfig')<RingConfig, { readonly refreshToken: string }>() {}

export const RingConfigLive = Layer.effect(
    RingConfig,
    Config.all({
        refreshToken: Config.string('RING_REFRESH_TOKEN'),
    }),
);

/** Recording snippet duration, output directory, and local cleanup behaviour. */
export class RecordingConfig extends Context.Tag('RecordingConfig')<
    RecordingConfig,
    { readonly snippetDuration: number; readonly directory: string; readonly cleanupAfterUpload: boolean }
>() {}

export const RecordingConfigLive = Layer.effect(
    RecordingConfig,
    Config.all({
        snippetDuration: Config.integer('RECORDING_DURATION').pipe(Config.withDefault(30)),
        directory: Config.string('RECORDING_DIR').pipe(Config.withDefault('/tmp')),
        cleanupAfterUpload: Config.boolean('CLEANUP_LOCAL_FILES').pipe(Config.withDefault(false)),
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

/** S3-compatible storage config. Optional — absent when S3 vars are not set. */
export class S3StorageConfig extends Context.Tag('S3StorageConfig')<S3StorageConfig, S3Config>() {}

export const S3StorageConfigLive = Layer.unwrapEffect(
    Config.all({
        core: Config.option(
            Config.all({
                endpoint: Config.string('S3_ENDPOINT'),
                region: Config.string('S3_REGION').pipe(Config.withDefault('auto')),
                bucket: Config.string('S3_BUCKET'),
                accessKeyId: Config.string('S3_ACCESS_KEY_ID'),
                secretAccessKey: Config.string('S3_SECRET_ACCESS_KEY'),
            }),
        ),
        publicUrl: Config.option(Config.string('S3_PUBLIC_URL')),
    }).pipe(
        Config.map(({ core, publicUrl }) =>
            Option.map(core, (c) => ({ ...c, publicUrl: Option.getOrUndefined(publicUrl) })),
        ),
        Effect.map(
            Option.match({
                onNone: () => Layer.empty,
                onSome: (value) => Layer.succeed(S3StorageConfig, value),
            }),
        ),
    ),
);

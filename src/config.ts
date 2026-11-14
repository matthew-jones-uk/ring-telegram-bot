import { Config, ConfigError, Context, Effect, Either, Layer, Option } from 'effect';
import { DEFAULT_KEY_TEMPLATE, validateKeyTemplate } from './recording';
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
            chatIds: Config.string('TELEGRAM_BOT_CHATS').pipe(
                Config.map((s) => s.split(/\s+/).filter(Boolean)),
                Config.validate({
                    message: 'TELEGRAM_BOT_CHATS must contain at least one chat ID',
                    validation: (ids): ids is string[] => ids.length > 0,
                }),
            ),
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
    {
        readonly snippetDuration: number;
        readonly directory: string;
        readonly cleanupAfterUpload: boolean;
        readonly keyTemplate: string;
    }
>() {}

export const RecordingConfigLive = Layer.effect(
    RecordingConfig,
    Config.all({
        snippetDuration: Config.integer('RECORDING_DURATION').pipe(Config.withDefault(30)),
        directory: Config.string('RECORDING_DIR').pipe(Config.withDefault('/tmp')),
        cleanupAfterUpload: Config.boolean('CLEANUP_LOCAL_FILES').pipe(Config.withDefault(false)),
        keyTemplate: Config.string('RECORDING_FILENAME_TEMPLATE').pipe(
            Config.withDefault(DEFAULT_KEY_TEMPLATE),
            Config.mapOrFail((template) => {
                const error = validateKeyTemplate(template);
                return error
                    ? Either.left(ConfigError.InvalidData([], `RECORDING_FILENAME_TEMPLATE: ${error}`))
                    : Either.right(template);
            }),
        ),
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
        forcePathStyle: Config.boolean('S3_FORCE_PATH_STYLE').pipe(Config.withDefault(false)),
    }).pipe(
        Config.map(({ core, publicUrl, forcePathStyle }) =>
            Option.map(core, (c) => ({ ...c, publicUrl: Option.getOrUndefined(publicUrl), forcePathStyle })),
        ),
        Effect.map(
            Option.match({
                onNone: () => Layer.empty,
                onSome: (value) => Layer.succeed(S3StorageConfig, value),
            }),
        ),
    ),
);

/** Prometheus `/metrics` endpoint. Optional: absent unless METRICS_PORT is set. */
export class MetricsConfig extends Context.Tag('MetricsConfig')<
    MetricsConfig,
    { readonly host: string; readonly port: number }
>() {}

export const MetricsConfigLive = Layer.unwrapEffect(
    Config.option(
        Config.all({
            port: Config.port('METRICS_PORT'),
            host: Config.string('METRICS_HOST').pipe(Config.withDefault('0.0.0.0')),
        }),
    ).pipe(
        Effect.map(
            Option.match({
                onNone: () => Layer.empty,
                onSome: (value) => Layer.succeed(MetricsConfig, value),
            }),
        ),
    ),
);

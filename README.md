# Ring Camera/Doorbell Telegram Bot

This detects motion events for Ring cameras/doorbells and uploads recordings to your configured storage destinations.

## Features

- 📹 Automatic recording on motion detection
- 📤 **Multiple upload destinations**: Telegram, S3/R2, or both simultaneously
- ☁️ **S3-compatible storage support**: Works with AWS S3, Cloudflare R2, MinIO, etc.
- 🧹 Optional automatic cleanup of local files after successful upload
- 🔄 Automatic Ring API token refresh

## Setup

### Quick Start

1. Copy the example configuration file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your configuration (see below)

3. Run the bot:
   ```bash
   npm install
   npm run build
   npm start
   ```

### Configuration

Create a `.env` file in the root directory. See `.env.example` for a complete reference with detailed comments.

#### Required Configuration

**RING_REFRESH_TOKEN**
- Ring API token for your account
- Instructions: [How to generate a refresh token](https://github.com/dgreif/ring/wiki/Refresh-Tokens)
- Note: This token auto-refreshes and the bot will update your `.env` file automatically

#### Telegram Configuration (optional — omit for S3-only deployments)

**TELEGRAM_BOT_TOKEN**
- Token from [@BotFather](https://t.me/BotFather)
- This token does not expire unless manually revoked

**TELEGRAM_BOT_CHATS**
- Space-separated list of chat IDs to send videos to
- Get your chat ID from [@userinfobot](https://t.me/userinfobot)
- Example: `123456789 987654321`

#### S3/R2 Configuration (optional — omit for Telegram-only deployments)

**S3_ENDPOINT**
- For Cloudflare R2: `https://[account-id].r2.cloudflarestorage.com`
- For AWS S3: `https://s3.amazonaws.com` or region-specific endpoint
- Find your R2 account ID in Cloudflare Dashboard → R2

**S3_REGION**
- `auto` for Cloudflare R2
- AWS region like `us-east-1` for AWS S3

**S3_BUCKET**
- Your S3/R2 bucket name
- Create this in your S3/R2 dashboard first

**S3_ACCESS_KEY_ID** and **S3_SECRET_ACCESS_KEY**
- For R2: Create in Cloudflare Dashboard → R2 → Manage R2 API Tokens
- For AWS S3: Create in IAM console
- These tokens do not expire by default

**S3_PUBLIC_URL** (optional)
- Custom domain for public access URLs
- Example: `https://recordings.example.com`
- If not set, URLs will use the S3 endpoint
- Note: For Cloudflare R2, configure custom domains in bucket settings → Public Access

**S3_FORCE_PATH_STYLE** (optional)
- Use path-style addressing (`endpoint/bucket/key`) instead of putting the bucket in the hostname
- Set to `true` for MinIO and most other self-hosted S3 servers
- Not needed for Cloudflare R2 or AWS S3
- Default: `false`

#### Optional Configuration

**RECORDING_DURATION**
- Duration in seconds to record after motion event
- Default: `30`

**RECORDING_DIR**
- Directory for temporary storage of recordings
- Default: `/tmp`
- Note: Directory must exist and be writable

**CLEANUP_LOCAL_FILES**
- Delete local files after successful upload to all destinations
- Options: `true` or `false`
- Default: `false`
- Files are only deleted if ALL uploads succeed

**RECORDING_FILENAME_TEMPLATE**
- Template for the S3/R2 object key (the path the recording is stored under). `.mp4` is added automatically
- Default: `{date}/{time}-{camera}-{subtype}-{duration}s`, which gives keys like `2026-11-13/214855.507-Front_Door-motion-30s.mp4`
- All dates and times are UTC
- Placeholders:

  | Placeholder | Value | Example |
  | --- | --- | --- |
  | `{timestamp}` | ISO 8601 basic format with milliseconds | `20261113T214855.507Z` |
  | `{date}` | Date | `2026-11-13` |
  | `{time}` | Time with milliseconds | `214855.507` |
  | `{camera}` | Camera name, with spaces and slashes replaced by `_` | `Front_Door` |
  | `{subtype}` | Event type reported by Ring | `motion` |
  | `{duration}` | Requested recording length in seconds (`RECORDING_DURATION`) | `30` |

- Use `/` to organise recordings into folders, e.g. `{camera}/{date}/{time}-{subtype}`
- Other than placeholders, only letters, digits, `.`, `_`, `-` and `/` are allowed
- The template must include `{timestamp}`, or both `{date}` and `{time}`, so recordings made close together can't overwrite each other
- An invalid template stops the bot at startup with an error that says what's wrong
- This only affects the S3/R2 key. The local file and the name shown in Telegram are always `{timestamp}-{camera}-{subtype}.mp4`
- Recordings already in the bucket keep their old names

**METRICS_PORT** (optional)
- Serve Prometheus metrics on this port at `/metrics`. Metrics are off unless this is set
- Example: `9464`
- There is no authentication, so only expose the port to your monitoring network. With Docker, don't publish it on the host; scrape it from another container on the same network (for example `ring_bot:9464`)
- If the port can't be bound the bot stops at startup with an error

**METRICS_HOST** (optional)
- Address the metrics server listens on
- Default: `0.0.0.0`

### Metrics

When `METRICS_PORT` is set, these are served at `/metrics`. Counters start at 0 each time the bot starts, so use `increase()` or `rate()` in queries.

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `ring_bot_events_received_total` | counter | `camera`, `event_type` | Push notifications from Ring, counted on arrival, before any recording |
| `ring_bot_events_handled_total` | counter | `outcome` (`ok`/`error`) | Events recorded and uploaded to every destination (`ok`) or not (`error`) |
| `ring_bot_events_in_flight` | gauge | | Events currently being recorded or uploaded |
| `ring_bot_downstream_call_duration_seconds` | histogram | `target`, `outcome` | Time spent recording (`camera_recording`) and uploading (`telegram`, `s3`) |
| `ring_bot_token_refreshes_total` | counter | `outcome` | Ring refresh token rotations, and whether the new token was saved to `.env` |
| `ring_bot_start_time_seconds` | gauge | | Unix time the bot started |

`ring_bot_events_received_total` is the one to watch for "Ring has stopped sending events": it counts arrivals, so it keeps working when uploads fail, and it is created at 0 for each camera at startup. The Effect runtime's own `effect_fiber_*` metrics are served as well.

### Example Configuration

#### Telegram Only
```bash
RING_REFRESH_TOKEN=your_ring_token_here
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_BOT_CHATS=123456789 987654321
RECORDING_DURATION=30
```

#### S3/R2 Only
```bash
RING_REFRESH_TOKEN=your_ring_token_here
S3_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=ring-recordings
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key
CLEANUP_LOCAL_FILES=true
```

#### Both Telegram and S3/R2
```bash
RING_REFRESH_TOKEN=your_ring_token_here

# Telegram configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_BOT_CHATS=123456789 987654321

# S3/R2 configuration
S3_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=ring-recordings
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key
S3_PUBLIC_URL=https://recordings.example.com

# Clean up after successful upload to both
CLEANUP_LOCAL_FILES=true
```

## Running

### Local Development
```bash
npm install
npm run build
npm start
```

### Docker
Mount your `.env` file into the container instead of passing it with `--env-file`:

```bash
docker build -t ring-telegram-bot .
docker run -d --restart unless-stopped \
  -v "$(pwd)/.env:/app/.env" \
  ring-telegram-bot
```

Or with Docker Compose:

```yaml
services:
  ring_bot:
    build: .
    restart: unless-stopped
    volumes:
      - ./.env:/app/.env
```

**Why a mount and not `--env-file`?** Ring rotates the refresh token, and the bot saves the new one by rewriting `.env` in its working directory (`/app/.env`). With `--env-file` there is no `.env` file inside the container, so the new token can't be saved and the next restart uses an old token that Ring has already invalidated (`Refresh token is not valid`).

Things to watch for:
- The `.env` file must exist on the host before the container starts, otherwise Docker creates a directory with that name.
- Don't also set the same variables with `--env-file` or `environment:`. Variables already set in the container win over the mounted file, so a stale `RING_REFRESH_TOKEN` would override the one the bot saves.
- If you edit `.env` on the host with a tool that replaces the file (for example `sed -i` or some editors), a running container keeps seeing the old copy. Recreate the container afterwards (`docker compose up -d --force-recreate`).

Note: When using Docker, ensure `RECORDING_DIR` points to a writable directory inside the container.

## Usage

### Telegram Setup
If using Telegram as a destination, you must send `/start` to your bot before it can send you messages. Once configured, when motion events are detected, you'll receive videos in your configured Telegram chats.

### How It Works
1. Bot connects to Ring API and listens for motion events
2. When motion is detected, records video for the configured duration
3. Uploads to all configured destinations in parallel
4. Logs upload results for each destination
5. Optionally cleans up local files if all uploads succeed

### Upload Timing
Total time from motion detection to notification:
- Recording duration (default 30s)
- Upload time (depends on file size and connection speed)
- For multiple destinations, uploads happen in parallel

## Troubleshooting

### S3/R2 Upload Issues

**"Access Denied" errors**
- Verify your `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are correct
- Ensure your API token has write permissions to the bucket
- For R2, check that the token hasn't expired (if you set an expiration)

**URLs not accessible**
- By default, R2 buckets are private
- Configure a custom domain in R2 bucket settings → Public Access
- Set `S3_PUBLIC_URL` to your custom domain
- Alternatively, enable public access on your bucket (not recommended for sensitive recordings)

**"Bucket not found" errors**
- Verify `S3_BUCKET` matches your bucket name exactly
- Ensure the bucket exists in your R2/S3 account
- Check `S3_REGION` is correct (`auto` for R2)

### Telegram Issues

**Bot not sending messages**
- Ensure you've sent `/start` to the bot
- Verify chat IDs are correct (use [@userinfobot](https://t.me/userinfobot))
- Check `TELEGRAM_BOT_TOKEN` is valid

**"Chat not found" errors**
- Chat ID might be incorrect
- For group chats, the bot must be added to the group first

### General Issues

**"Refresh token is not valid" on startup**
- Ring refresh tokens are rotated, and an old one stops working. Generate a new one with `npx -p ring-client-api ring-auth-cli`, put it in `.env`, and restart
- If it keeps happening in Docker, check that `.env` is mounted into the container (see [Docker](#docker)) so the bot can save rotated tokens
- Don't use the same refresh token in another tool (such as Home Assistant); they invalidate each other

**No motion events detected**
- Verify Ring devices are online in the Ring app
- Check that motion detection is enabled on your devices
- Review logs for connection errors

**Recording fails**
- Ensure `RECORDING_DIR` exists and is writable
- Check disk space is available
- Verify ffmpeg is installed (required for video recording)
- Check logs for errors

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
```bash
docker build -t ring-telegram-bot .
docker run -d --env-file .env ring-telegram-bot
```

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

**No motion events detected**
- Verify Ring devices are online in the Ring app
- Check that motion detection is enabled on your devices
- Review logs for connection errors

**Recording fails**
- Ensure `RECORDING_DIR` exists and is writable
- Check disk space is available
- Verify ffmpeg is installed (required for video recording)
- Check logs for errors

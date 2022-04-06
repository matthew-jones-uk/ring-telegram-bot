# Ring Camera/Doorbell Telegram Bot

This detects motion events for Ring cameras/doorbells and sends a recording via a Telegram bot.

## Setup

### Config

You need to create a `.env` file in the root directory with the following entries:

- RING_REFRESH_TOKEN

    Ring API token for your account. Instructions on how to generate can be found [here](https://github.com/dgreif/ring/wiki/Refresh-Tokens).

- TELEGRAM_BOT_TOKEN

    Token for your Telegram bot.

- TELEGRAM_BOT_CHATS

    Chat IDs for the people you want the bot to message. IDs should be separated by spaces.

- RECORDING_DIR

    Absolute path to the directory where recordings should be saved. The directory should be created.

- RECORDING_DURATION

    Duration (in seconds) to record for after a motion event. Defaults to 15 seconds.

#### Example

```bash
RING_REFRESH_TOKEN="ASALDKNASLKDJNASLKFJNASLKDNASDKLNJASDKLJASNDLKJASDNLKJASNDLKASJDNLKASJDNALSKDJNASLKDJNASLKDJASNLDASLDKJAS:DLKJASLDKJASDLKASJD:LASKJDLASDNKASJDNKLASJDNAKJSBDHAJSKDBHAKJSBDHASJKBDHASKJDHBASKJDBHASKJDHBASDKJBASHDKJBASHDKJBASHDJSJHBAJSF"
TELEGRAM_BOT_TOKEN="1234567890:dfgkalsifjgusjdmvuskdugksbdiakfldja"
# split by spaces
TELEGRAM_BOT_CHATS="123456789 987654321"
RECORDING_DIR="/tmp/recordings"
RECORDING_DURATION=15
```

### Running

You can either start directly via `npm install` then `node index.js`, or you can use a container with the Dockerfile.

## Usage

You will have to have sent `/start` to the bot for it to send messages to you. From then on, when motion events are detected (and your chat ID is in the config) you will recieve a message with the video for the motion event.

To recieve your message, it will take `your recording duration + video upload duration`. This means that with a long duration or a slow internet upload speed there may be a significant delay.

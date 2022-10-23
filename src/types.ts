type TelegramConfig = {
    botToken: string;
    chatIds: string[];
};

type RingConfig = {
    refreshToken: string;
};

type RecordingConfig = {
    snippetDuration: number;
    directory: string;
};

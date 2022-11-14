import { BotClient } from "@trixis/lib-ts-bot";
import { QueueRepeatMode } from "discord-player";

export default {
  default: {
    botStarted: (client: BotClient) => `Бот ${client.user?.tag} запущен`,
    extension: "Расширение",
    commands: "Команды",
  },
  music: {
    musicCommandName: "music",
    musicCommandDescription: "ВЫ СЛЫШИТЕ ЭТУ МУЗЫКУ?",
    playButtonEmoji: "⏯️",
    stopButtonEmoji: "⏹️",
    shuffleButtonEmoji: "🔀",
    addTrackButtonEmoji: "➕",
    removeTrackButtonEmoji: "➖",
    loopButtonEmoji: "🔁",
    nothingPlayingEmbedTitle: "Сейчас ничего не играет",
    durationFieldName: "Длительность",
    loopFieldName: "Повтор",
    loopTypes: {
      [QueueRepeatMode.OFF.toString()]: "Выключен",
      [QueueRepeatMode.QUEUE.toString()]: "Плейлист",
      [QueueRepeatMode.TRACK.toString()]: "Трек",
    },
    trackDurationFormat: "HHч mmм ssс",
  },
} as const;

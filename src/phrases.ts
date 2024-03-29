import { BotClient } from "@trixis/lib-ts-bot";
import { QueueRepeatMode, Track } from "discord-player";
import { User } from "discord.js";

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
    trackDurationFormat: "HH:mm:ss",
    trackInputLabel: "Трек",
    addTrackModalTitle: "Добавить трек",
    shouldBeInVoiceChannel: "Вы должны находиться в голосовом канале",
    couldNotConnectToVoiceChannel: "Не удалось подключиться к голосому каналу",
    tracksNotFound: "Не удалось найти треки по вашему запросу",
    requestedByFmt: (user: User) => `От ${user.displayName}`,
    pauseFieldName: "Пауза",
    pauseEnabled: "Включена",
    pauseDisabled: "Выключена",
    loopTypeSetFmt: (loopTypeName: string) =>
      `Повтор установлен на ${loopTypeName}`,
    selectTrackToRemove: "Выберите трек, чтобы удалить",
    trackRemovedFmt: (track: Track) =>
      `Трек ${track.title} удален из плейлиста`,
    noTracks: "В плейлисте нет треков",
    playlistStatsFmt: (tracksCount: number, duration: string) =>
      `Всего ${tracksCount} треков на ${duration}`,
  },
} as const;

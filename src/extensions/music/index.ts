import { BaseExtension, BotClient, eventHandler } from "@trixis/lib-ts-bot";
import { Player, Queue, QueueRepeatMode, Track } from "discord-player";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildResolvable,
  SelectMenuBuilder,
} from "discord.js";
import {
  addTrackButtonCustomId,
  loopButtonCustomId,
  playButtonCustomId,
  removeTrackButtonCustomId,
  shuffleButtonCustomId,
  stopButtonCustomId,
  trackSelectMenuCustomId,
} from "../../customId";
import phrases from "../../phrases";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import constants from "../../utils/constants";

dayjs.extend(duration);

export enum LoopType {
  Off = QueueRepeatMode.OFF,
  Queue = QueueRepeatMode.QUEUE,
  Track = QueueRepeatMode.TRACK,
}

export default class MusicExtension extends BaseExtension {
  readonly player = new Player(this.client, {
    ytdlOptions: {
      filter: "audioonly",
      highWaterMark: 2 ** 25, // 32 MB
      dlChunkSize: 0,
    },
  });

  getQueue(guild: GuildResolvable) {
    return this.player.getQueue(guild) ?? this.player.createQueue(guild);
  }

  createPlayerEmbeds(queue: Queue) {
    if (!queue.playing) {
      const embed = new EmbedBuilder().setTitle(
        phrases.music.nothingPlayingEmbedTitle
      );

      return [embed];
    }

    const currentTrack = queue.nowPlaying();
    const embed = new EmbedBuilder()
      .setTitle(currentTrack.title)
      .setURL(currentTrack.url)
      .addFields(
        {
          name: phrases.music.durationFieldName,
          value: this.formatTrackDuration(currentTrack.durationMS),
          inline: true,
        },
        {
          name: phrases.music.loopFieldName,
          value: phrases.music.loopTypes[queue.repeatMode],
          inline: true,
        }
      )
      .setThumbnail(currentTrack.thumbnail)
      .setAuthor({
        name: currentTrack.requestedBy.tag,
        iconURL: currentTrack.requestedBy.displayAvatarURL(),
      });

    return [embed];
  }

  formatTrackDuration(durationMs: number) {
    const duration = dayjs.duration(durationMs);
    return duration.format(phrases.music.trackDurationFormat);
  }

  createPlayerComponents(queue: Queue) {
    const disabled = !queue.playing;

    const firstRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(playButtonCustomId.prefix)
        .setEmoji(phrases.music.playButtonEmoji)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(stopButtonCustomId.prefix)
        .setEmoji(phrases.music.stopButtonEmoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(addTrackButtonCustomId.prefix)
        .setEmoji(phrases.music.addTrackButtonEmoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );

    const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(loopButtonCustomId.prefix)
        .setEmoji(phrases.music.loopButtonEmoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(shuffleButtonCustomId.prefix)
        .setEmoji(phrases.music.shuffleButtonEmoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(removeTrackButtonCustomId.prefix)
        .setEmoji(phrases.music.removeTrackButtonEmoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );

    const rows: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[] = [
      firstRow,
      secondRow,
    ];

    if (queue.tracks.length > 0) {
      const thirdRow = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        new SelectMenuBuilder()
          .setCustomId(trackSelectMenuCustomId.prefix)
          .addOptions(
            queue.tracks
              .slice(constants.discord.selectMenuMaxOptionsAmount)
              .map((track) => ({
                label: track.title,
                value: track.id,
              }))
          )
      );

      rows.push(thirdRow);
    }

    return rows;
  }
}

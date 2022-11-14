import {
  BaseExtension,
  BotClient,
  buttonInteractionHandler,
  checkCustomId,
  eventHandler,
  modalSubmitInteractionHandler,
} from "@trixis/lib-ts-bot";
import {
  Player,
  PlayerSearchResult,
  Queue,
  QueueRepeatMode,
  Track,
} from "discord-player";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  GuildResolvable,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  addTrackButtonCustomId,
  addTrackModalCustomId,
  loopButtonCustomId,
  playButtonCustomId,
  removeTrackButtonCustomId,
  shuffleButtonCustomId,
  stopButtonCustomId,
  trackInputCustomId,
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

  @checkCustomId(playButtonCustomId)
  @buttonInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async playButtonHandler(interaction: ButtonInteraction) {
    await interaction.showModal(this.createAddTrackModal());
  }

  @checkCustomId(addTrackModalCustomId)
  @modalSubmitInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async addTrackModalHandler(interaction: ModalSubmitInteraction) {
    await interaction.deferUpdate();

    const queue = this.getQueue(interaction.guild!);
    const member = interaction.member as GuildMember;

    if (!queue.connection?.channel) {
      if (!member.voice.channel) {
        return await interaction.editReply({
          content: phrases.music.shouldBeInVoiceChannel,
        });
      }

      try {
        await queue.connect(member.voice.channel);
      } catch {
        return await interaction.editReply({
          content: phrases.music.couldNotConnectToVoiceChannel,
        });
      }
    }

    const trackQuery = interaction.fields.getTextInputValue(
      trackInputCustomId.prefix
    );

    const searchResult = await this.player.search(trackQuery, {
      requestedBy: interaction.user,
    });

    const tracks = this.extractTracksFromSearchResult(searchResult);

    if (tracks.length === 0) {
      return await interaction.editReply({
        content: phrases.music.tracksNotFound,
      });
    }

    queue.addTracks(tracks);

    if (!queue.playing) {
      await queue.play();
    }

    await interaction.editReply({
      embeds: this.createPlayerEmbeds(queue),
      components: this.createPlayerComponents(queue),
    });
  }

  extractTracksFromSearchResult(searchResult: PlayerSearchResult) {
    if (searchResult.playlist?.tracks.length) {
      return searchResult.playlist.tracks;
    }

    if (!searchResult.tracks.length) {
      return [];
    }

    return [searchResult.tracks[0]];
  }

  createAddTrackModal() {
    const row =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(trackInputCustomId.prefix)
          .setLabel(phrases.music.trackInputLabel)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      );

    const modal = new ModalBuilder()
      .setCustomId(addTrackModalCustomId.prefix)
      .setTitle(phrases.music.addTrackModalTitle)
      .addComponents(row);

    return modal;
  }

  getQueue(guild: GuildResolvable) {
    return this.player.getQueue(guild) ?? this.player.createQueue(guild);
  }

  createPlayerEmbeds(queue: Queue) {
    if (!queue.connection?.audioResource) {
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
    const disabled = !queue.connection?.audioResource;

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
              .slice(0, constants.discord.selectMenuMaxOptionsAmount)
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

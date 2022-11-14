import {
  BaseExtension,
  buttonInteractionHandler,
  checkCustomId,
  CustomId,
  DefaultMap,
  eventHandler,
  modalSubmitInteractionHandler,
  selectMenuInteractionHandler,
} from "@trixis/lib-ts-bot";
import {
  Player,
  PlayerSearchResult,
  QueryType,
  Queue,
  QueueRepeatMode,
  Track,
} from "discord-player";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Collection,
  CommandInteraction,
  EmbedBuilder,
  GuildMember,
  GuildResolvable,
  MessageComponentInteraction,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SelectMenuBuilder,
  SelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  WebhookEditMessageOptions,
} from "discord.js";
import {
  addTrackButtonCustomId,
  addTrackModalCustomId,
  loopButtonCustomId,
  loopSelectMenuCustomId,
  playButtonCustomId,
  removeTrackButtonCustomId,
  removeTrackSelectMenuCustomId,
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

type PlayerInteraction =
  | MessageComponentInteraction
  | ModalSubmitInteraction
  | CommandInteraction;

export default class MusicExtension extends BaseExtension {
  readonly player = new Player(this.client, {
    ytdlOptions: {
      filter: "audioonly",
      highWaterMark: 2 ** 25, // 32 MB
      dlChunkSize: 0,
    },
  });

  playerInteractions: DefaultMap<
    string,
    Collection<string, PlayerInteraction>
  > = new DefaultMap(() => new Collection());

  async register() {
    await super.register();
    this.player.on("trackStart", (queue, track) =>
      this.updateQueuePlayerInteractions(queue)
    );
  }

  @checkCustomId(playButtonCustomId)
  @buttonInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async playButtonHandler(interaction: ButtonInteraction) {
    const queue = this.getQueue(interaction.guild!);

    if (queue.playing && queue.connection) {
      const paused = !queue.connection.paused;
      queue.setPaused(paused);

      await interaction.update({
        embeds: this.createPlayerEmbeds(queue),
      });

      return await this.updateQueuePlayerInteractions(queue);
    }

    await interaction.showModal(this.createAddTrackModal());
  }

  @checkCustomId(addTrackModalCustomId)
  @modalSubmitInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async addTrackModalHandler(interaction: ModalSubmitInteraction) {
    await interaction.deferUpdate();

    const queue = this.getQueue(interaction.guild!);
    const member = interaction.member as GuildMember;

    const trackQuery = interaction.fields.getTextInputValue(
      trackInputCustomId.prefix
    );

    const searchResult = await this.player.search(trackQuery, {
      requestedBy: interaction.user,
      searchEngine: QueryType.AUTO,
    });

    const tracks = this.extractTracksFromSearchResult(searchResult);

    if (tracks.length === 0) {
      return await interaction.editReply({
        content: phrases.music.tracksNotFound,
      });
    }

    if (!queue.playing && !queue.connection?.channel) {
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

    queue.addTracks(tracks);

    if (!queue.playing) {
      await queue.play();
      queue.playing = true;
    }

    await this.updateQueuePlayerInteractions(queue);
  }

  @checkCustomId(stopButtonCustomId)
  @buttonInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async stopButtonHandler(interaction: ButtonInteraction) {
    const queue = this.getQueue(interaction.guild!);

    queue.clear();

    if (queue.playing) {
      queue.skip();
      queue.playing = false;
    }

    await interaction.update({
      embeds: this.createPlayerEmbeds(queue),
      components: this.createPlayerComponents(queue),
    });

    await this.updateQueuePlayerInteractions(queue);
  }

  @checkCustomId(addTrackButtonCustomId)
  @buttonInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async addTrackHandler(interaction: ButtonInteraction) {
    await interaction.showModal(this.createAddTrackModal());
  }

  @checkCustomId(loopButtonCustomId)
  @buttonInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async loopHandler(interaction: ButtonInteraction) {
    await interaction.reply({
      components: this.createLoopSelectComponents(),
      ephemeral: true,
    });
  }

  @checkCustomId(loopSelectMenuCustomId)
  @selectMenuInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async loopSelectHandler(interaction: SelectMenuInteraction) {
    const loopType = parseInt(interaction.values[0]);
    const loopTypeName = phrases.music.loopTypes[interaction.values[0]];
    const queue = this.getQueue(interaction.guild!);

    queue.setRepeatMode(loopType);

    await interaction.update({
      content: phrases.music.loopTypeSetFmt(loopTypeName),
    });

    await this.updateQueuePlayerInteractions(queue);
  }

  @checkCustomId(shuffleButtonCustomId)
  @buttonInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async shuffleHandler(interaction: ButtonInteraction) {
    const queue = this.getQueue(interaction.guild!);
    queue.shuffle();

    await interaction.update({
      components: this.createPlayerComponents(queue),
    });

    await this.updateQueuePlayerInteractions(queue);
  }

  async updateQueuePlayerInteractions(queue: Queue) {
    const interactions = this.playerInteractions.get(queue.guild.id);

    if (interactions.size === 0) {
      return;
    }

    const options: WebhookEditMessageOptions = {
      embeds: this.createPlayerEmbeds(queue),
      components: this.createPlayerComponents(queue),
    };

    const updatePlayerInteraction = async (interaction: PlayerInteraction) => {
      try {
        await interaction.editReply(options);
      } catch {
        interactions.delete(interaction.id);
      }
    };

    await Promise.all(
      interactions.map((interaction) => updatePlayerInteraction(interaction))
    );
  }

  @checkCustomId(removeTrackButtonCustomId)
  @buttonInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async removeTrackHandler(interaction: ButtonInteraction) {
    const queue = this.getQueue(interaction.guild!);

    if (queue.tracks.length === 0) {
      return await interaction.reply({
        content: phrases.music.noTracks,
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: phrases.music.selectTrackToRemove,
      components: [
        this.createTrackSelectMenu(removeTrackSelectMenuCustomId, queue.tracks),
      ],
      ephemeral: true,
    });
  }

  @checkCustomId(removeTrackSelectMenuCustomId)
  @selectMenuInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async removeTrackSelectHandler(interaction: SelectMenuInteraction) {
    const queue = this.getQueue(interaction.guild!);
    const removedTrack = queue.remove(interaction.values[0]);
    await interaction.update({
      content: phrases.music.trackRemovedFmt(removedTrack),
      components: [],
    });
    await this.updateQueuePlayerInteractions(queue);
  }

  @checkCustomId(trackSelectMenuCustomId)
  @selectMenuInteractionHandler()
  @eventHandler({ event: "interactionCreate" })
  async strackSelectHandler(interaction: SelectMenuInteraction) {
    const queue = this.getQueue(interaction.guild!);
    const track = queue.tracks.find(
      (track) => track.id === interaction.values[0]
    );

    if (!track) {
      return;
    }

    queue.skipTo(track);

    await interaction.update({
      embeds: this.createPlayerEmbeds(queue),
      components: this.createPlayerComponents(queue),
    });
  }

  createLoopSelectComponents() {
    const row = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
      new SelectMenuBuilder()
        .setCustomId(loopSelectMenuCustomId.prefix)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          Object.entries(phrases.music.loopTypes).map((entry) => ({
            label: entry[1],
            value: entry[0],
          }))
        )
    );

    return [row];
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
        },
        {
          name: phrases.music.pauseFieldName,
          value: queue.connection?.paused
            ? phrases.music.pauseEnabled
            : phrases.music.pauseDisabled,
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
      rows.push(
        this.createTrackSelectMenu(trackSelectMenuCustomId, queue.tracks)
      );
    }

    return rows;
  }

  sumTrackDurations(tracks: Track[]) {
    let durationMs = 0;

    for (const track of tracks) {
      durationMs += track.durationMS;
    }

    return durationMs;
  }

  createTrackSelectMenu(customId: CustomId, tracks: Track[]) {
    const sumTrackDuration = this.sumTrackDurations(tracks);

    return new ActionRowBuilder<SelectMenuBuilder>().addComponents(
      new SelectMenuBuilder()
        .setCustomId(customId.prefix)
        .setMinValues(1)
        .setMaxValues(1)
        .setPlaceholder(
          phrases.music.playlistStatsFmt(
            tracks.length,
            this.formatTrackDuration(sumTrackDuration)
          )
        )
        .addOptions(
          tracks
            .slice(0, constants.discord.selectMenuMaxOptionsAmount)
            .map((track) => ({
              label: track.title,
              value: track.id,
              description: phrases.music.requestedByFmt(track.requestedBy),
            }))
        )
    );
  }
}

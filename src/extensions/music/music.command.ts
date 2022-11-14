import { SlashCommandBuilder } from "discord.js";
import MusicExtension from ".";
import {
  BaseSlashCommand,
  commandHandler,
  CommandContext,
  guildOnlyCommand,
} from "@trixis/lib-ts-bot";
import phrases from "../../phrases";

@guildOnlyCommand()
export default class MusicCommand extends BaseSlashCommand<MusicExtension> {
  constructor(extension: MusicExtension) {
    const builder = new SlashCommandBuilder()
      .setName(phrases.music.musicCommandName)
      .setDescription(phrases.music.musicCommandDescription);

    super(extension, builder);
  }

  @commandHandler({ autoDeferOptions: null })
  async run({ interaction, guild }: CommandContext) {
    const queue = this.extension.getQueue(guild!);

    this.extension.playerInteractions
      .get(guild!.id)
      .set(interaction.id, interaction);

    await interaction.reply({
      embeds: this.extension.createPlayerEmbeds(queue),
      components: this.extension.createPlayerComponents(queue),
      ephemeral: true,
    });
  }
}

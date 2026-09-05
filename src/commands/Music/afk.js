import { SlashCommandBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { joinVoiceChannel, replyMusicSuccess } from '../../services/music/musicActions.js';
import { deferMusicCommand } from '../../services/music/prefixSupport.js';

export default {
    category: 'Music',

    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Join your voice channel and stay there until told to leave'),

    async execute(interaction, config, client) {
        const deferred = await deferMusicCommand(interaction);

        if (!deferred) {
            return;
        }

        try {
            const embed = await joinVoiceChannel(
                client,
                interaction
            );

            await replyMusicSuccess(
                interaction,
                embed
            );
        } catch (error) {
            console.error(
                'AFK voice error:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ I could not join your voice channel.',
            }).catch(() => {});
        }
    },
};

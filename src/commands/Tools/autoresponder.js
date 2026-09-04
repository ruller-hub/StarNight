import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription('Manage server autoresponders')

        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add an autoresponder')
                .addStringOption(option =>
                    option
                        .setName('trigger')
                        .setDescription('The message that should trigger the response')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('reply')
                        .setDescription('The response the bot should send')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove an autoresponder')
                .addStringOption(option =>
                    option
                        .setName('trigger')
                        .setDescription('The trigger to remove')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all autoresponders in this server')
        ),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral
        });

        if (!deferSuccess) {
            logger.warn('Autoresponder interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const trigger = interaction.options.getString('trigger');
            const reply = interaction.options.getString('reply');

            // TODO: Save trigger + reply to your autoresponder storage

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ Autoresponder created!\n\n**Trigger:** \`${trigger}\`\n**Reply:** ${reply}`
            });

            return;
        }

        if (subcommand === 'remove') {
            const trigger = interaction.options.getString('trigger');

            // TODO: Remove trigger from your autoresponder storage

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ Autoresponder \`${trigger}\` has been removed.`
            });

            return;
        }

        if (subcommand === 'list') {
            // TODO: Get autoresponders from your storage

            await InteractionHelper.safeEditReply(interaction, {
                content: '📋 Your server has no autoresponders yet.'
            });

            return;
        }
    }
};

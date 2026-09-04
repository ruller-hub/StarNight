import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import {
    setAutoResponse,
    deleteAutoResponse,
    getAllAutoResponses
} from '../../services/autoResponderService.js';
console.log('🔥 AUTO RESPONDER COMMAND FILE LOADED');

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

            setAutoResponse(trigger, reply);

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ Autoresponder created!\n\n**Trigger:** \`${trigger}\`\n**Reply:** ${reply}`
            });

            return;
        }

        if (subcommand === 'remove') {
            const trigger = interaction.options.getString('trigger');

            const removed = deleteAutoResponse(trigger);

            await InteractionHelper.safeEditReply(interaction, {
                content: removed
                    ? `✅ Autoresponder \`${trigger}\` has been removed.`
                    : `❌ No autoresponder found for \`${trigger}\`.`
            });

            return;
        }

        if (subcommand === 'list') {
            const responders = getAllAutoResponses();

            const entries = Object.entries(responders);

            if (entries.length === 0) {
                await InteractionHelper.safeEditReply(interaction, {
                    content: '📋 Your server has no autoresponders yet.'
                });
                return;
            }

            const list = entries
                .map(([trigger, reply]) => `• \`${trigger}\` → ${reply}`)
                .join('\n');

            await InteractionHelper.safeEditReply(interaction, {
                content: `📋 **Autoresponders**\n\n${list}`
            });

            return;
        }
    }
};
```

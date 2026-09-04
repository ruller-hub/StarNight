import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setnickname')
        .setDescription('Change a member\'s nickname')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The member whose nickname you want to change')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('nickname')
                .setDescription('The new nickname')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const nickname = interaction.options.getString('nickname');

        const member = await interaction.guild.members.fetch(user.id);

        if (!member) {
            return interaction.reply({
                content: '❌ Member not found.',
                ephemeral: true
            });
        }

        if (!member.manageable) {
            return interaction.reply({
                content: '❌ I cannot change this member\'s nickname.',
                ephemeral: true
            });
        }

        await member.setNickname(nickname);

        await interaction.reply({
            content: `✅ Changed ${user} nickname to **${nickname}**.`
        });
    }
};

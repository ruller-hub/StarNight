import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Give a role to a member')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The member to give the role to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('role')
                .setDescription('The role name')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const roleName = interaction.options
            .getString('role')
            ?.trim();

        if (!user || !roleName) {
            return interaction.reply({
                content: '❌ Usage: `r @user RoleName`',
                ephemeral: true
            });
        }

        const member = await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member) {
            return interaction.reply({
                content: '❌ Member not found.',
                ephemeral: true
            });
        }

        const role = interaction.guild.roles.cache.find(
            r =>
                r.name.toLowerCase() ===
                roleName.toLowerCase()
        );

        if (!role) {
            return interaction.reply({
                content:
                    `❌ Role **${roleName}** not found.`,
                ephemeral: true
            });
        }

        if (role.managed) {
            return interaction.reply({
                content:
                    '❌ I cannot give a managed role.',
                ephemeral: true
            });
        }

        const botMember =
            interaction.guild.members.me;

        if (!botMember) {
            return interaction.reply({
                content:
                    '❌ I could not find my bot member.',
                ephemeral: true
            });
        }

        if (
            botMember.roles.highest.position <=
            role.position
        ) {
            return interaction.reply({
                content:
                    '❌ That role is higher than or equal to my highest role.',
                ephemeral: true
            });
        }

        if (member.roles.cache.has(role.id)) {
            return interaction.reply({
                content:
                    `❌ ${user} already has ${role}.`,
                ephemeral: true
            });
        }

        try {
            await member.roles.add(role);

            return interaction.reply({
                content:
                    `✅ Gave ${role} to ${user}.`
            });

        } catch (error) {
            console.error(
                'Error giving role:',
                error
            );

            return interaction.reply({
                content:
                    '❌ I could not give that role.',
                ephemeral: true
            });
        }
    }
};

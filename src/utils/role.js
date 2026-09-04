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
        .setDescription('The name of the role to give')
        .setRequired(true)
)

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');

        const member = await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member) {
            return interaction.reply({
                content: '❌ Member not found.',
                ephemeral: true
            });
        }

        if (!role) {
            return interaction.reply({
                content: '❌ Role not found.',
                ephemeral: true
            });
        }

        if (role.managed) {
            return interaction.reply({
                content: '❌ I cannot give a managed/integration role.',
                ephemeral: true
            });
        }

        if (
            interaction.guild.members.me.roles.highest.position <=
            role.position
        ) {
            return interaction.reply({
                content: '❌ That role is higher than or equal to my highest role.',
                ephemeral: true
            });
        }

        if (member.roles.cache.has(role.id)) {
            return interaction.reply({
                content: `❌ ${user} already has the ${role} role.`,
                ephemeral: true
            });
        }

        await member.roles.add(role);

        await interaction.reply({
            content: `✅ Gave ${role} to ${user}.`
        });
    }
};

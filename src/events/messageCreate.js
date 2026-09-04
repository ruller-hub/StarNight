import { getAutoResponse } from '../services/autoResponderService.js';
import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling/leveling.js';
import { addXp } from '../services/leveling/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { parsePrefixCommand } from '../utils/prefixParser.js';
import {
  supportsPrefixExecution,
  executePrefixCommand,
  resolvePrefixAccessKey
} from '../utils/messageAdapter.js';
import {
  resolveCommandAlias,
  resolveSubcommandAlias
} from '../config/commands/commandAliases.js';
import { getPrefixRestriction } from '../config/commands/prefixRestrictions.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import {
  getCommandPrefix,
  getBotMessage,
  isBotOwner,
  isCommandCategoryEnabled,
  isMaintenanceMode
} from '../config/bot.js';
import {
  enforceAbuseProtection,
  formatCooldownDuration
} from '../utils/abuseProtection.js';
import { createEmbed } from '../utils/embeds.js';
import { isCommandEnabled } from '../services/commandAccessService.js';

import {
  getCountingGameConfig,
  saveCountingGameConfig,
  isValidCountingMessage,
  recordCorrectCount,
} from '../services/countingGameService.js';

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

export default {
  name: Events.MessageCreate,

  async execute(message, client) {
    try {
      if (message.author.bot || !message.guild) return;

      logger.debug(
        `Message received from ${message.author.tag}: ${message.content}`
      );

      await handleAutoResponder(message);

      const countingProcessed = await handleCountingGame(message, client);

      if (countingProcessed) {
        return;
      }

      await handlePrefixCommand(message, client);

      await handleLeveling(message, client);

    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};

async function handleAutoResponder(message) {
  const response = getAutoResponse(message.content);

  if (!response) {
    return false;
  }

  await message.reply(response);
  return true;
}

async function handlePrefixCommand(message, client) {
  try {
    const guildConfig = await getGuildConfig(
      client,
      message.guild.id
    );

    const prefix = guildConfig?.prefix ?? getCommandPrefix();

    let parsed = null;

    // =========================================================
    // PREFIX COMMAND
    // Example: !ban @user
    // =========================================================

    if (prefix && message.content.startsWith(prefix)) {
      parsed = parsePrefixCommand(
        message.content,
        prefix
      );
    }

    // =========================================================
    // PREFIXLESS COMMAND
    // Example: ban @user
    // =========================================================

    if (!parsed) {
      const content = message.content.trim();

      if (content) {
        const parts = content.split(/\s+/);

        const possibleCommand =
          parts[0].toLowerCase();

        const resolvedPossibleCommand =
          resolveCommandAlias(possibleCommand);

        if (
          client.commands.has(
            resolvedPossibleCommand
          )
        ) {
          parsed = {
            commandName: possibleCommand,
            args: parts.slice(1),
          };
        }
      }
    }

    // =========================================================
    // NICKNAME SHORTCUT
    // Example:
    // n @lania xwshki a7a
    //
    // User: @lania
    // Nickname: xwshki a7a
    // =========================================================

    if (!parsed) {
      const parts =
        message.content.trim().split(/\s+/);

      if (
        parts[0]?.toLowerCase() === 'n'
      ) {
        if (parts.length < 3) {
          await message.channel.send(
            '❌ Usage: `n @user nickname`'
          ).catch(() => {});

          return;
        }

        parsed = {
          commandName: 'setnickname',

          // First argument = user
          // Everything after = nickname
          args: [
            parts[1],
            parts.slice(2).join(' ')
          ],
        };
      }
    }

    // Nothing detected
    if (!parsed) {
      return;
    }

    // =========================================================
    // GET COMMAND + ARGS
    // =========================================================

    let { commandName, args } = parsed;

    // =========================================================
    // EXTRA SAFETY FOR SETNICKNAME
    //
    // If another parser already created:
    //
    // ["@lania", "xwshki", "a7a"]
    //
    // turn it into:
    //
    // ["@lania", "xwshki a7a"]
    // =========================================================

    if (
      commandName?.toLowerCase() === 'setnickname' &&
      args.length >= 2
    ) {
      args = [
        args[0],
        args.slice(1).join(' ')
      ];
    }

    // =========================================================
    // MUSIC SHORTCUTS
    // =========================================================

    const musicPrefixShortcut =
      commandName.toLowerCase();

    const MUSIC_PREFIX_SHORTCUTS =
      new Set([
        'leave',
        'pause',
        'resume',
        'skip',
        'stop',
        'volume',
      ]);

    if (
      MUSIC_PREFIX_SHORTCUTS.has(
        musicPrefixShortcut
      )
    ) {
      commandName = 'music';

      args = [
        musicPrefixShortcut,
        ...args
      ];
    }

    logger.info(
      `Prefix command detected: ${commandName}, args: ${args.join(', ')}`
    );

    // =========================================================
    // RESOLVE COMMAND
    // =========================================================

    const resolvedCommandName =
      resolveCommandAlias(commandName);

    logger.info(
      `Resolved command name: ${resolvedCommandName}`
    );

    const command =
      client.commands.get(
        resolvedCommandName
      );

    if (!command) {
      logger.warn(
        `Command not found: ${resolvedCommandName}`
      );

      return;
    }

    // =========================================================
    // MAINTENANCE MODE
    // =========================================================

    if (
      isMaintenanceMode() &&
      !isBotOwner(message.author.id)
    ) {
      await message.channel.send({
        embeds: [
          createEmbed({
            title: 'Maintenance Mode',
            description:
              getBotMessage(
                'maintenanceMode'
              ),
            color: 'warning',
          }),
        ],
      }).catch(() => {});

      return;
    }

    // =========================================================
    // CATEGORY CHECK
    // =========================================================

    if (
      !isCommandCategoryEnabled(
        command.category
      )
    ) {
      await message.channel.send({
        embeds: [
          createEmbed({
            title: 'Feature Disabled',
            description:
              getBotMessage(
                'commandDisabled'
              ),
            color: 'error',
          }),
        ],
      }).catch(() => {});

      return;
    }

    // =========================================================
    // PREFIX RESTRICTION
    // =========================================================

    const restriction =
      getPrefixRestriction(
        command,
        args,
        resolveSubcommandAlias
      );

    if (
      !supportsPrefixExecution(command) ||
      restriction.blocked
    ) {
      if (
        restriction.blocked &&
        restriction.reason
      ) {
        const embed = createEmbed({
          title: 'Slash Command Only',
          description:
            `${restriction.reason}\nUse \`/${resolvedCommandName}\` instead.`,
          color: 'info',
        });

        await message.channel.send({
          embeds: [embed],
        }).catch(() => {});
      }

      return;
    }

    // =========================================================
    // COMMAND ENABLED CHECK
    // =========================================================

    const accessKey =
      resolvePrefixAccessKey(
        command.data,
        args
      );

    const commandEnabled =
      await isCommandEnabled(
        client,
        message.guild.id,
        accessKey,
        command.category
      );

    if (!commandEnabled) {
      const embed = createEmbed({
        title: 'Command Disabled',
        description:
          'This command has been disabled for this server.',
        color: 'error',
      });

      await message.channel.send({
        embeds: [embed],
      }).catch(() => {});

      return;
    }

    // =========================================================
    // ABUSE PROTECTION
    // =========================================================

    const mockInteractionForProtection = {
      guildId: message.guild.id,
      user: message.author,
    };

    const abuseProtection =
      await enforceAbuseProtection(
        mockInteractionForProtection,
        command,
        resolvedCommandName
      );

    if (!abuseProtection.allowed) {
      const formattedCooldown =
        formatCooldownDuration(
          abuseProtection.remainingMs
        );

      const embed = createEmbed({
        title: 'Command Cooldown',
        description:
          `This command is on cooldown. Please wait ${formattedCooldown} before trying again.`,
        color: 'error',
      });

      await message.channel.send({
        embeds: [embed],
      }).catch(() => {});

      return;
    }

    // =========================================================
    // EXECUTE COMMAND
    // =========================================================

    logger.info(
      `Executing prefix command: ${prefix}${commandName} ` +
      `(resolved to ${resolvedCommandName}) ` +
      `by ${message.author.tag}`
    );

    await executePrefixCommand(
      command,
      message,
      args,
      client,
      prefix,
      guildConfig
    );

  } catch (error) {
    logger.error(
      'Error handling prefix command:',
      error
    );
  }
}

async function handleCountingGame(
  message,
  client
) {
  try {
    const config =
      await getCountingGameConfig(
        client,
        message.guild.id
      );

    if (
      !config.enabled ||
      !config.channelId ||
      message.channel.id !==
        config.channelId
    ) {
      return false;
    }

    const content =
      message.content.trim();

    const validCount =
      isValidCountingMessage(
        content,
        config
      );

    const invalidAttempt =
      !validCount ||
      message.author.id ===
        config.lastUserId;

    if (invalidAttempt) {
      await message.delete()
        .catch(() => {});

      await saveCountingGameConfig(
        client,
        message.guild.id,
        {
          ...config,
          nextNumber: 1,
          lastUserId: null,
          currentStreak: 0,
        }
      );

      const failureMessage =
        await message.channel.send(
          `❌ Count broken by <@${message.author.id}>. The sequence has been reset to **1**.`
        );

      setTimeout(() => {
        failureMessage
          .delete()
          .catch(() => {});
      }, 10000);

      return true;
    }

    await recordCorrectCount(
      client,
      message.guild.id,
      message.author.id
    );

    return true;

  } catch (error) {
    logger.error(
      'Error handling counting game:',
      error
    );

    return false;
  }
}

async function handleLeveling(
  message,
  client
) {
  try {
    const rateLimitKey =
      `xp-event:${message.guild.id}:${message.author.id}`;

    const canProcess =
      await checkRateLimit(
        rateLimitKey,
        MESSAGE_XP_RATE_LIMIT_ATTEMPTS,
        MESSAGE_XP_RATE_LIMIT_WINDOW_MS
      );

    if (!canProcess) {
      return;
    }

    const levelingConfig =
      await getLevelingConfig(
        client,
        message.guild.id
      );

    if (!levelingConfig?.enabled) {
      return;
    }

    if (
      levelingConfig.ignoredChannels
        ?.includes(message.channel.id)
    ) {
      return;
    }

    if (
      levelingConfig.ignoredRoles?.length > 0
    ) {
      const member =
        await message.guild.members
          .fetch(message.author.id)
          .catch(() => null);

      if (
        member &&
        member.roles.cache.some(
          role =>
            levelingConfig.ignoredRoles.includes(
              role.id
            )
        )
      ) {
        return;
      }
    }

    if (
      levelingConfig.blacklistedUsers
        ?.includes(message.author.id)
    ) {
      return;
    }

    if (
      !message.content ||
      message.content.trim().length === 0
    ) {
      return;
    }

    const userData =
      await getUserLevelData(
        client,
        message.guild.id,
        message.author.id
      );

    const cooldownTime =
      levelingConfig.xpCooldown || 60;

    const now = Date.now();

    const timeSinceLastMessage =
      now - (userData.lastMessage || 0);

    if (
      timeSinceLastMessage <
      cooldownTime * 1000
    ) {
      return;
    }

    const minXP =
      levelingConfig.xpRange?.min ||
      levelingConfig.xpPerMessage?.min ||
      15;

    const maxXP =
      levelingConfig.xpRange?.max ||
      levelingConfig.xpPerMessage?.max ||
      25;

    const safeMinXP =
      Math.max(1, minXP);

    const safeMaxXP =
      Math.max(
        safeMinXP,
        maxXP
      );

    const xpToGive =
      Math.floor(
        Math.random() *
        (safeMaxXP - safeMinXP + 1)
      ) + safeMinXP;

    let finalXP = xpToGive;

    if (
      levelingConfig.xpMultiplier &&
      levelingConfig.xpMultiplier > 1
    ) {
      finalXP = Math.floor(
        finalXP *
        levelingConfig.xpMultiplier
      );
    }

    const result =
      await addXp(
        client,
        message.guild,
        message.member,
        finalXP
      );

    if (result?.leveledUp) {
      logger.info(
        `${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`
      );
    }

  } catch (error) {
    logger.error(
      'Error handling leveling for message:',
      error
    );
  }
}

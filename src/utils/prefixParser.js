// prefixParser.js

import { resolveSubcommandAlias } from '../config/commands/commandAliases.js';
import { logger } from './logger.js';

export function parsePrefixCommand(content, prefix) {
  if (!content) {
    return null;
  }

  const trimmed = content.trim();

  if (!trimmed) {
    return null;
  }

  /*
   * ROLE SHORTCUT
   *
   * r @user Moderator
   * r @user Server Moderator
   *
   * This works WITHOUT the normal bot prefix.
   */
  const parts = parseArguments(trimmed);

  if (
    parts.length >= 3 &&
    parts[0].toLowerCase() === 'r'
  ) {
    return {
      commandName: 'role',
      args: parts.slice(1)
    };
  }

  /*
   * Normal prefix command
   *
   * Example:
   * !ping
   * !role @user Moderator
   */
  if (!prefix || !trimmed.startsWith(prefix)) {
    return null;
  }

  const withoutPrefix = trimmed
    .slice(prefix.length)
    .trim();

  if (!withoutPrefix) {
    return null;
  }

  const args = parseArguments(withoutPrefix);

  if (args.length === 0) {
    return null;
  }

  const commandName = args[0].toLowerCase();
  const commandArgs = args.slice(1);

  return {
    commandName,
    args: commandArgs
  };
}

function parseArguments(input) {
  const args = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;

        if (current.length > 0) {
          args.push(current);
        }

        current = '';
      } else {
        current += char;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      if (current.trim()) {
        args.push(current.trim());
        current = '';
      }

      inQuote = true;
      quoteChar = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.trim()) {
        args.push(current.trim());
        current = '';
      }

      continue;
    }

    current += char;
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

export function mapArgumentsToOptions(args, commandData) {
  const options = {};
  let subcommandName = null;
  let subcommandGroupName = null;

  const cmdData = commandData?.toJSON
    ? commandData.toJSON()
    : commandData;

  /*
   * Commands without options
   */
  if (!cmdData || !cmdData.options) {
    return {
      _positional: args,

      get: (name) => args[0] || null,

      getString: (name) =>
        args[0] || null,

      getUser: (name) =>
        args[0] || null,

      getMember: (name) =>
        args[0] || null,

      getChannel: (name) =>
        args[0] || null,

      getRole: (name) =>
        args[0] || null,

      getInteger: (name) =>
        args[0]
          ? parseInt(args[0], 10)
          : null,

      getBoolean: (name) =>
        args[0] === 'true',

      getSubcommand: () =>
        null,

      getSubcommandGroup: () =>
        null,

      validateRequired: () => ({
        valid: true,
        missing: []
      })
    };
  }

  const subcommandGroup =
    cmdData.options.find(
      option => option.type === 2
    );

  const subcommands =
    cmdData.options.filter(
      option => option.type === 1
    );

  const hasSubcommands =
    subcommands.length > 0 &&
    !subcommandGroup;

  let currentArgs = args;
  let optionDefs = [];

  logger.debug(
    `Parsing prefix command: commandName=${cmdData.name}, args=${JSON.stringify(args)}, hasSubcommands=${hasSubcommands}, hasSubcommandGroup=${!!subcommandGroup}, optionsCount=${cmdData.options.length}`
  );

  /*
   * SUBCOMMAND GROUP
   */
  if (subcommandGroup) {
    if (args.length > 0) {
      subcommandGroupName =
        args[0].toLowerCase();

      const group =
        subcommandGroup.options?.find(
          group =>
            group.name ===
            subcommandGroupName
        );

      if (
        group &&
        args.length > 1
      ) {
        subcommandName =
          resolveSubcommandAlias(
            args[1]
          );

        const sub =
          group.options?.find(
            sub =>
              sub.name ===
              subcommandName
          );

        if (sub) {
          optionDefs =
            sub.options?.filter(
              option =>
                option.type !== 1 &&
                option.type !== 2
            ) || [];

          currentArgs =
            args.slice(2);
        } else {
          logger.debug(
            `Subcommand ${subcommandName} not found in group ${subcommandGroupName}`
          );
        }
      } else if (!group) {
        logger.debug(
          `Subcommand group ${subcommandGroupName} not found`
        );
      }
    }

  /*
   * NORMAL SUBCOMMAND
   */
  } else if (hasSubcommands) {
    if (args.length > 0) {
      const resolvedSubcommand =
        resolveSubcommandAlias(
          args[0]
        );

      logger.debug(
        `Looking for subcommand: ${resolvedSubcommand}, available: ${subcommands
          .map(s => s.name)
          .join(', ')}`
      );

      const sub =
        subcommands.find(
          s =>
            s.name ===
            resolvedSubcommand
        );

      if (sub) {
        subcommandName =
          resolvedSubcommand;

        optionDefs =
          sub.options?.filter(
            option =>
              option.type !== 1 &&
              option.type !== 2
          ) || [];

        currentArgs =
          args.slice(1);

        logger.debug(
          `Found subcommand ${subcommandName}, optionDefs: ${optionDefs.length}`
        );
      } else {
        logger.debug(
          `Subcommand ${resolvedSubcommand} not found`
        );
      }
    }

  /*
   * NORMAL COMMAND OPTIONS
   */
  } else {
    optionDefs =
      cmdData.options.filter(
        option =>
          option.type !== 1 &&
          option.type !== 2
      );
  }

  /*
   * Map positional arguments to command options.
   */
  for (
    let i = 0;
    i <
    Math.min(
      currentArgs.length,
      optionDefs.length
    );
    i++
  ) {
    const optionDef =
      optionDefs[i];

    const value =
      currentArgs[i];

    options[optionDef.name] =
      value;
  }

  /*
   * Required option validation.
   */
  const missing = [];

  if (
    subcommandName ||
    (!hasSubcommands &&
      !subcommandGroup)
  ) {
    for (const opt of optionDefs) {
      if (
        opt.required &&
        !options[opt.name]
      ) {
        missing.push({
          name: opt.name,
          description:
            opt.description,
          type: opt.type
        });
      }
    }
  }

  /*
   * Missing subcommand.
   */
  if (
    (hasSubcommands ||
      subcommandGroup) &&
    !subcommandName &&
    !subcommandGroupName
  ) {
    const availableSubcommands =
      hasSubcommands
        ? subcommands
            .map(s => s.name)
            .join(',') ||
          'none'
        : subcommandGroup?.options
            ?.map(g => g.name)
            .join(',') ||
          'none';

    missing.push({
      name: subcommandGroup
        ? 'subcommand group'
        : 'subcommand',

      description:
        `Available: ${availableSubcommands}`,

      type: 1
    });

  } else if (
    hasSubcommands &&
    args.length > 0 &&
    !subcommandName
  ) {
    missing.push({
      name: 'subcommand',

      description:
        `Available: ${subcommands
          .map(s => s.name)
          .join(', ')}`,

      type: 1
    });

  } else if (
    subcommandGroup &&
    subcommandGroupName &&
    !subcommandName
  ) {
    const group =
      subcommandGroup.options?.find(
        g =>
          g.name ===
          subcommandGroupName
      );

    const availableSubcommands =
      group?.options
        ?.map(s => s.name)
        .join(',') ||
      'none';

    missing.push({
      name: 'subcommand',

      description:
        `Available: ${availableSubcommands}`,

      type: 1
    });
  }

  /*
   * Return Discord-like option getters.
   */
  return {
    ...options,

    _positional: args,

    get: name =>
      options[name] || null,

    getString: name =>
      options[name] || null,

    getUser: name =>
      options[name] || null,

    getMember: name =>
      options[name] || null,

    getChannel: name =>
      options[name] || null,

    getRole: name =>
      options[name] || null,

    getInteger: name =>
      options[name]
        ? parseInt(
            options[name],
            10
          )
        : null,

    getBoolean: name =>
      options[name] === 'true',

    getSubcommand: () =>
      subcommandName,

    getSubcommandGroup: () =>
      subcommandGroupName,

    validateRequired: () => ({
      valid:
        missing.length === 0,

      missing,

      subcommandName,

      subcommandGroupName,

      optionDefs
    })
  };
}

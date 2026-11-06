import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} from 'discord.js';
import { db, getSetting, setSetting } from './database.js';
import { isLinkMessage } from './profile-link-guard.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS moderation_warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS moderation_warnings_lookup
    ON moderation_warnings (guild_id, user_id, id);
`);

const STAFF_PERMISSION = PermissionFlagsBits.ManageMessages;
const moderationCommands = [
  new SlashCommandBuilder()
    .setName('setup-softban-channel')
    .setDescription('Create and enable the channel that softbans members who post in it')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('allow-bot')
    .setDescription('Approve a bot account so it can stay in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(option => option.setName('bot').setDescription('Bot account to approve').setRequired(true)),
  new SlashCommandBuilder()
    .setName('remove-allowed-bot')
    .setDescription('Remove a bot account from the approved list')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(option => option.setName('bot').setDescription('Bot account to remove from the approved list').setRequired(true)),
  new SlashCommandBuilder()
    .setName('list-allowed-bots')
    .setDescription('Show bot accounts approved to stay in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('disable-softban-channel')
    .setDescription('Disable automatic softbans for the configured channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Record a moderation warning for a member')
    .setDefaultMemberPermissions(STAFF_PERMISSION)
    .addUserOption(option => option.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Why this warning is being issued').setMaxLength(500).setRequired(true)),
  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View a member’s recent moderation warnings')
    .setDefaultMemberPermissions(STAFF_PERMISSION)
    .addUserOption(option => option.setName('user').setDescription('Member whose warnings to view').setRequired(true)),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily prevent a member from chatting')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('Member to timeout').setRequired(true))
    .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes (1–40320)').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the timeout').setMaxLength(500).setRequired(false)),
  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a member’s active timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('Member to untimeout').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for removing the timeout').setMaxLength(500).setRequired(false)),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete 1–100 recent messages from this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to delete (1–100)').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder()
    .setName('clearlinks')
    .setDescription('Preview, then delete link-containing messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option => option.setName('limit').setDescription('Newest messages to scan (1–10000; default 10000)').setMinValue(1).setMaxValue(10000).setRequired(false))
    .addBooleanOption(option => option.setName('confirm').setDescription('Set true to delete the links found in this scan').setRequired(false))
    .addStringOption(option => option.setName('before').setDescription('Continue older than the previous scan’s message ID').setMaxLength(20).setRequired(false)),
].map(command => command.toJSON());

async function scanChannelForLinks(channel, maxMessages, startingBefore) {
  const matches = [];
  let scanned = 0;
  let before = startingBefore || undefined;

  while (scanned < maxMessages) {
    const batchLimit = Math.min(100, maxMessages - scanned);
    const batch = await channel.messages.fetch({
      limit: batchLimit,
      ...(before ? { before } : {})
    });
    const messages = [...batch.values()];
    if (!messages.length) break;

    scanned += messages.length;
    for (const message of messages) {
      if (isLinkMessage(message)) matches.push(message);
    }

    const oldest = messages.reduce((currentOldest, message) =>
      BigInt(message.id) < BigInt(currentOldest.id) ? message : currentOldest
    , messages[0]);
    before = oldest.id;
    if (messages.length < batchLimit) break;
  }

  let hasMore = false;
  if (scanned >= maxMessages && before) {
    const nextPage = await channel.messages.fetch({ limit: 1, before }).catch(() => null);
    hasMore = Boolean(nextPage?.size);
  }

  return { matches, scanned, nextBefore: hasMore ? before : null };
}

async function deleteLinkMessages(channel, messages) {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recent = messages.filter(message => message.createdTimestamp >= cutoff);
  const older = messages.filter(message => message.createdTimestamp < cutoff);
  let deleted = 0;
  let failed = 0;

  // Discord only supports bulk deletion for messages newer than 14 days.
  for (let index = 0; index < recent.length; index += 100) {
    const batch = recent.slice(index, index + 100);
    if (batch.length < 2 || typeof channel.bulkDelete !== 'function') {
      for (const message of batch) {
        try { await message.delete(); deleted += 1; }
        catch { failed += 1; }
      }
      continue;
    }
    try {
      const result = await channel.bulkDelete(batch, true);
      deleted += result.size;
      failed += batch.length - result.size;
    } catch (error) {
      console.warn('[Moderation] Bulk link cleanup failed; retrying messages individually:', error?.message || error);
      for (const message of batch) {
        try { await message.delete(); deleted += 1; }
        catch { failed += 1; }
      }
    }
  }

  // Older messages must be deleted one at a time because Discord rejects bulk deletion.
  for (const message of older) {
    try { await message.delete(); deleted += 1; }
    catch { failed += 1; }
  }

  return { deleted, failed };
}

function hasPermission(interaction, permission) {
  return interaction.inGuild() && interaction.memberPermissions?.has(permission);
}

async function fetchTarget(interaction) {
  const user = interaction.options.getUser('user', true);
  if (user.id === interaction.user.id) return { error: 'You cannot use this action on yourself.' };
  if (user.id === interaction.client.user.id) return { error: 'I cannot apply this action to myself.' };
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return { error: 'That user is not a member of this server.' };
  const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const botMember = interaction.guild.members.me;
  if (!moderator || !botMember) return { error: 'I could not verify role permissions. Please try again.' };
  if (member.id === interaction.guild.ownerId && moderator.id !== interaction.guild.ownerId) {
    return { error: 'The server owner cannot be moderated by you.' };
  }
  if (moderator.id !== interaction.guild.ownerId && moderator.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    return { error: 'Your highest role must be above the target member’s highest role.' };
  }
  if (botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    return { error: 'My highest role must be above the target member’s highest role. Move my role higher in Server Settings → Roles.' };
  }
  return { user, member };
}

export async function handleModerationCommand(interaction) {
  if (!['warn', 'warnings', 'timeout', 'untimeout', 'purge', 'clearlinks', 'setup-softban-channel', 'disable-softban-channel', 'allow-bot', 'remove-allowed-bot', 'list-allowed-bots'].includes(interaction.commandName)) return false;
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Use moderation commands inside a server.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const command = interaction.commandName;
  if (['allow-bot', 'remove-allowed-bot', 'list-allowed-bots'].includes(command)) {
    if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to manage the approved bot list.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (command === 'list-allowed-bots') {
      const ids = db.prepare('SELECT user_id FROM approved_server_bots WHERE guild_id = ? ORDER BY user_id').all(interaction.guildId);
      await interaction.reply({ content: ids.length ? '**Approved bots:**\\n' + ids.map(row => '• <@' + row.user_id + '> (ID: ' + row.user_id + ')').join('\\n') : 'No bots have been approved yet.', flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      return true;
    }
    const botUser = interaction.options.getUser('bot', true);
    if (command === 'allow-bot') {
      if (!botUser.bot) {
        await interaction.reply({ content: 'That account is not a bot account.', flags: MessageFlags.Ephemeral });
        return true;
      }
      db.prepare('INSERT OR IGNORE INTO approved_server_bots (guild_id, user_id, approved_by) VALUES (?, ?, ?)').run(interaction.guildId, botUser.id, interaction.user.id);
      await interaction.reply({ content: '✅ Approved **' + botUser.username + '**. This bot is now on the allowlist for this server.', flags: MessageFlags.Ephemeral });
    } else {
      db.prepare('DELETE FROM approved_server_bots WHERE guild_id = ? AND user_id = ?').run(interaction.guildId, botUser.id);
      await interaction.reply({ content: 'Removed **' + botUser.username + '** from the approved list. If it joins again, Meta will kick it.', flags: MessageFlags.Ephemeral });
    }
    return true;
  }
  if (command === 'setup-softban-channel') {
    if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to configure this.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const existingId = getSetting(interaction.guildId, 'softban_channel_id');
      const existing = existingId ? await interaction.guild.channels.fetch(existingId).catch(() => null) : null;
      if (existing?.isTextBased()) {
        await interaction.editReply('The softban channel is already configured: ' + existing.toString() + '. Use /disable-softban-channel before creating another.');
        return true;
      }
      const channel = await interaction.guild.channels.create({
        name: 'softban',
        type: ChannelType.GuildText,
        topic: '⚠️ Automatic softban zone: sending a message here will softban you. Staff with Manage Messages are exempt.',
        reason: 'Meta Code automatic softban channel setup'
      });
      setSetting(interaction.guildId, 'softban_channel_id', channel.id);
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('⚠️ Automatic Softban Channel')
        .setDescription('**Do not send messages in this channel.** Any regular member who posts here will be automatically softbanned (banned and immediately unbanned), and their messages from the last 7 days will be deleted. Staff with Manage Messages permission and bots are exempt.')
        .setFooter({ text: 'Meta Code Moderation' })
        .setTimestamp();
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      await interaction.editReply('Created and enabled ' + channel.toString() + '. Make sure I have **Ban Members** permission and my highest role is above regular members.');
    } catch (error) {
      console.error('[Moderation] Softban channel setup failed:', error?.message || error);
      await interaction.editReply('I could not create the channel. Check that I have Manage Channels permission.');
    }
    return true;
  }
  if (command === 'disable-softban-channel') {
    if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to configure this.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const current = getSetting(interaction.guildId, 'softban_channel_id');
    if (!current) {
      await interaction.reply({ content: 'Automatic softbans are already disabled.', flags: MessageFlags.Ephemeral });
      return true;
    }
    setSetting(interaction.guildId, 'softban_channel_id', '');
    await interaction.reply({ content: 'Automatic softbans are now disabled. The channel was left in place.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const needed = command === 'timeout' || command === 'untimeout'
    ? PermissionFlagsBits.ModerateMembers
    : STAFF_PERMISSION;
  if (!hasPermission(interaction, needed)) {
    await interaction.reply({ content: 'You do not have the required server permission for this command.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (command === 'purge') {
    if (!interaction.channel?.isTextBased() || !interaction.channel.messages?.bulkDelete) {
      await interaction.reply({ content: 'This command only works in a standard text channel.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const amount = interaction.options.getInteger('amount', true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.editReply(`Deleted **${deleted.size}** recent messages. Discord does not allow bulk deletion of messages older than 14 days.`);
    } catch (error) {
      console.error('Purge failed:', error.message);
      await interaction.editReply('I could not delete those messages. Check that I have Manage Messages permission in this channel.');
    }
    return true;
  }
  if (command === 'clearlinks') {
    const channel = interaction.channel;
    if (!channel?.isTextBased?.() || !channel.messages?.fetch) {
      await interaction.reply({ content: 'Use this command in a text channel or thread.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const botMember = interaction.guild.members.me;
    if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: 'I need the Manage Messages permission in this channel to remove links.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const limit = interaction.options.getInteger('limit') ?? 10000;
    const confirm = interaction.options.getBoolean('confirm') ?? false;
    const before = interaction.options.getString('before')?.trim() || undefined;
    if (before && !/^\\d{17,20}$/.test(before)) {
      await interaction.reply({ content: 'The before value must be a valid Discord message ID from a previous scan.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const { matches, scanned, nextBefore } = await scanChannelForLinks(channel, limit, before);
      const nextPageHint = nextBefore
        ? `\n\nThere are older messages. To scan the next batch, run \`/clearlinks before:${nextBefore}\`.`
        : '';
      if (!matches.length) {
        await interaction.editReply(`No link-containing messages were found in this batch of **${scanned.toLocaleString()}** scanned. Nothing was deleted.${nextPageHint}`);
        return true;
      }

      if (!confirm) {
        await interaction.editReply(
          `Found **${matches.length.toLocaleString()}** messages containing links in this batch of **${scanned.toLocaleString()}** scanned. Nothing has been deleted yet.\n\nRun \`/clearlinks limit:${limit} confirm:True${before ? ` before:${before}` : ''}\` to delete those messages. Messages older than 14 days are deleted individually.${nextPageHint}`
        );
        return true;
      }

      const result = await deleteLinkMessages(channel, matches);
      await interaction.editReply(
        `Link cleanup finished in ${channel}. Scanned **${scanned.toLocaleString()}** messages; deleted **${result.deleted.toLocaleString()}** link-containing messages.${result.failed ? ` Failed to delete **${result.failed.toLocaleString()}** messages (check my channel permissions and message availability).` : ''}${nextPageHint}`
      );
    } catch (error) {
      console.error('[Moderation] Clear-links command failed:', error?.message || error);
      await interaction.editReply('Link cleanup could not finish. Check that I have View Channel, Read Message History, and Manage Messages permissions, then try again.');
    }
    return true;
  }


  if (command === 'warnings') {
    const user = interaction.options.getUser('user', true);
    const rows = db.prepare(`
      SELECT id, moderator_id, reason, created_at
      FROM moderation_warnings
      WHERE guild_id = ? AND user_id = ?
      ORDER BY id DESC LIMIT 10
    `).all(interaction.guildId, user.id);
    const total = db.prepare(
      'SELECT COUNT(*) AS count FROM moderation_warnings WHERE guild_id = ? AND user_id = ?'
    ).get(interaction.guildId, user.id).count;
    const embed = new EmbedBuilder()
      .setColor(0xF0B232)
      .setTitle(`Warnings for ${user.username}`)
      .setDescription(rows.length
        ? rows.map(row => `**#${row.id}** • <t:${Math.floor(new Date(row.created_at.replace(' ', 'T') + 'Z').getTime() / 1000)}:R>\nReason: ${row.reason.slice(0, 350)}\nModerator: <@${row.moderator_id}>`).join('\n\n').slice(0, 3900)
        : 'No warnings recorded for this member.')
      .setFooter({ text: `${total} total warning(s) • showing up to the 10 most recent` });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return true;
  }

  const target = await fetchTarget(interaction);
  if (target.error) {
    await interaction.reply({ content: target.error, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (command === 'warn') {
    const reason = interaction.options.getString('reason', true).trim();
    const result = db.prepare(
      'INSERT INTO moderation_warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)'
    ).run(interaction.guildId, target.user.id, interaction.user.id, reason || 'No reason provided');
    const embed = new EmbedBuilder()
      .setColor(0xF0B232)
      .setTitle('⚠️ Member warned')
      .setDescription(`Member: <@${target.user.id}>\nWarning: **#${result.lastInsertRowid}**\nReason: ${reason}`)
      .setFooter({ text: `Moderator: ${interaction.user.username} • Meta Code` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    return true;
  }

  const reason = interaction.options.getString('reason')?.trim() || `Action by ${interaction.user.username}`;
  if (command === 'timeout') {
    const minutes = interaction.options.getInteger('minutes', true);
    if (!target.member.moderatable) {
      await interaction.reply({ content: 'I cannot timeout this member. Check role hierarchy and my Moderate Members permission.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await target.member.timeout(minutes * 60 * 1000, reason);
    await interaction.reply({
      content: `⏳ Timed out <@${target.user.id}> for **${minutes} minute(s)**.\nReason: ${reason}`,
      allowedMentions: { parse: [] },
    });
    return true;
  }

  if (command === 'untimeout') {
    if (!target.member.moderatable) {
      await interaction.reply({ content: 'I cannot remove this member’s timeout. Check role hierarchy and my Moderate Members permission.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!target.member.isCommunicationDisabled()) {
      await interaction.reply({ content: 'That member does not currently have an active timeout.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await target.member.timeout(null, reason);
    await interaction.reply({ content: `✅ Removed the timeout for <@${target.user.id}>.\nReason: ${reason}`, allowedMentions: { parse: [] } });
    return true;
  }

  return false;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS approved_server_bots (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );
`);

export async function handleUnapprovedBotJoin(member) {
  if (!member?.guild || !member.user?.bot) return;
  const approved = db.prepare('SELECT 1 FROM approved_server_bots WHERE guild_id = ? AND user_id = ?').get(member.guild.id, member.id);
  if (approved) return;
  const botMember = member.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.KickMembers) || !member.kickable) {
    console.error('[Moderation] Could not kick unapproved bot; check Kick Members permission and role hierarchy.', member.id);
    return;
  }
  try {
    await member.kick('Meta Code security: bot is not on this server’s approved bot list');
    console.log('[Moderation] Kicked unapproved bot account:', member.id, 'from', member.guild.id);
  } catch (error) {
    console.error('[Moderation] Failed to kick unapproved bot:', error?.message || error);
  }
}

export async function handleSoftbanMessage(message) {
  if (!message.guild || message.author?.bot || message.webhookId) return;
  const configuredChannelId = getSetting(message.guild.id, 'softban_channel_id');
  if (!configuredChannelId || message.channel.id !== configuredChannelId) return;
  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member || member.id === message.guild.ownerId || member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
  const botMember = message.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers) ||
      !member.bannable ||
      botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    console.error('[Moderation] Cannot softban member in configured channel; check Ban Members permission and role hierarchy.');
    return;
  }
  try {
    const reason = 'Automatic softban: posted in the designated softban channel';
    await message.guild.members.ban(member.id, {
      deleteMessageSeconds: 7 * 24 * 60 * 60,
      reason
    });
    await message.guild.members.unban(member.id, 'Automatic softban completed');
    console.log('[Moderation] Softbanned member for posting in configured channel:', member.id);
  } catch (error) {
    console.error('[Moderation] Automatic softban failed:', error?.message || error);
  }
}

export { moderationCommands };

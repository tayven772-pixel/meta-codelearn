import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from './database.js';

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
].map(command => command.toJSON());

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
  if (!['warn', 'warnings', 'timeout', 'untimeout', 'purge'].includes(interaction.commandName)) return false;
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Use moderation commands inside a server.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const command = interaction.commandName;
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

export { moderationCommands };

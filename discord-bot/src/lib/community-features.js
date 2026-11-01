import {
  ActionRowBuilder, ChannelType, EmbedBuilder, MessageFlags,
  PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder
} from 'discord.js';
import { db, getSetting, setSetting } from './database.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS community_xp (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, xp INTEGER NOT NULL DEFAULT 0,
    messages INTEGER NOT NULL DEFAULT 0, last_message_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS community_giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
    message_id TEXT, prize TEXT NOT NULL, winners INTEGER NOT NULL DEFAULT 1,
    ends_at INTEGER NOT NULL, ended INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS community_giveaways_due ON community_giveaways(ended, ends_at);
  CREATE TABLE IF NOT EXISTS community_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const admin = PermissionFlagsBits.Administrator;
const manageRoles = PermissionFlagsBits.ManageRoles;
const manageGuild = PermissionFlagsBits.ManageGuild;
const textChannels = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export const communityCommands = [
  new SlashCommandBuilder().setName('welcome-config').setDescription('Configure the welcome channel and message')
    .setDefaultMemberPermissions(admin)
    .addChannelOption(o => o.setName('channel').setDescription('Welcome channel').addChannelTypes(...textChannels).setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Use {user}, {server}, and {membercount}').setMaxLength(1500).setRequired(true)),
  new SlashCommandBuilder().setName('autorole').setDescription('Set or clear the automatic join role')
    .setDefaultMemberPermissions(manageRoles)
    .addRoleOption(o => o.setName('role').setDescription('Role to assign to new members; omit to disable').setRequired(false)),
  new SlashCommandBuilder().setName('logging').setDescription('Configure the moderation and server event log channel')
    .setDefaultMemberPermissions(manageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('Log channel').addChannelTypes(...textChannels).setRequired(true)),
  new SlashCommandBuilder().setName('level').setDescription('View your community level or another member’s')
    .addUserOption(o => o.setName('user').setDescription('Member to inspect').setRequired(false)),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Show the server activity leaderboard'),
  new SlashCommandBuilder().setName('giveaway').setDescription('Start a giveaway in this channel')
    .setDefaultMemberPermissions(manageGuild)
    .addStringOption(o => o.setName('prize').setDescription('What is being given away?').setMaxLength(180).setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration (5–10080 minutes)').setMinValue(5).setMaxValue(10080).setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (1–10)').setMinValue(1).setMaxValue(10).setRequired(true)),
  new SlashCommandBuilder().setName('giveaway-end').setDescription('End a giveaway early using its message ID')
    .setDefaultMemberPermissions(manageGuild)
    .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)),
  new SlashCommandBuilder().setName('role-menu').setDescription('Post a self-service role selection menu')
    .setDefaultMemberPermissions(manageRoles)
    .addStringOption(o => o.setName('title').setDescription('Menu title').setMaxLength(100).setRequired(true))
    .addRoleOption(o => o.setName('role1').setDescription('First self-assignable role').setRequired(true))
    .addRoleOption(o => o.setName('role2').setDescription('Second self-assignable role').setRequired(false))
    .addRoleOption(o => o.setName('role3').setDescription('Third self-assignable role').setRequired(false))
    .addRoleOption(o => o.setName('role4').setDescription('Fourth self-assignable role').setRequired(false))
    .addRoleOption(o => o.setName('role5').setDescription('Fifth self-assignable role').setRequired(false)),
  new SlashCommandBuilder().setName('serverstats').setDescription('Show a detailed server statistics panel'),
  new SlashCommandBuilder().setName('config-export').setDescription('Export Meta bot settings for this server')
    .setDefaultMemberPermissions(admin)
].map(command => command.toJSON());

function isAdmin(interaction) {
  return interaction.inGuild() && interaction.memberPermissions?.has(admin);
}

function logChannelId(guildId) {
  return getSetting(guildId, 'community_log_channel_id');
}

async function sendLog(guild, embed) {
  const id = logChannelId(guild.id);
  if (!id) return;
  const channel = await guild.channels.fetch(id).catch(() => null);
  if (channel?.isTextBased() && channel.send) {
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
  }
}

export async function handleCommunityCommand(interaction) {
  const name = interaction.commandName;
  if (!communityCommands.some(c => c.name === name)) return false;
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Use this command inside a server.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'welcome-config') {
    if (!isAdmin(interaction)) {
      await interaction.reply({ content: 'Only administrators can configure welcome messages.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true).trim();
    if (!message) {
      await interaction.reply({ content: 'Welcome message cannot be blank.', flags: MessageFlags.Ephemeral });
      return true;
    }
    setSetting(interaction.guildId, 'community_welcome_channel_id', channel.id);
    setSetting(interaction.guildId, 'community_welcome_message', message);
    await interaction.reply({ content: `Welcome messages will be sent in ${channel}. Available placeholders: {user}, {server}, {membercount}.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'autorole') {
    if (!interaction.memberPermissions?.has(manageRoles)) {
      await interaction.reply({ content: 'You need Manage Roles permission.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const role = interaction.options.getRole('role');
    if (role && (role.id === interaction.guildId || role.managed || role.position >= interaction.guild.members.me.roles.highest.position)) {
      await interaction.reply({ content: 'Choose a normal role below my highest role.', flags: MessageFlags.Ephemeral });
      return true;
    }
    setSetting(interaction.guildId, 'community_autorole_id', role?.id || '');
    await interaction.reply({ content: role ? `New members will receive the ${role.name} role.` : 'Automatic join roles disabled.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'logging') {
    if (!interaction.memberPermissions?.has(manageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const channel = interaction.options.getChannel('channel', true);
    setSetting(interaction.guildId, 'community_log_channel_id', channel.id);
    await interaction.reply({ content: `Server event logs will be sent to ${channel}.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'level' || name === 'leaderboard') {
    const rows = db.prepare('SELECT user_id, xp, messages FROM community_xp WHERE guild_id = ? ORDER BY xp DESC LIMIT 10').all(interaction.guildId);
    if (name === 'level') {
      const user = interaction.options.getUser('user') || interaction.user;
      const row = db.prepare('SELECT xp, messages FROM community_xp WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, user.id) || { xp: 0, messages: 0 };
      const level = Math.floor(Math.sqrt(row.xp / 100));
      const next = (level + 1) ** 2 * 100;
      const embed = new EmbedBuilder().setColor(0x42B883).setTitle(`Activity profile: ${user.username}`)
        .addFields(
          { name: 'Level', value: String(level), inline: true },
          { name: 'XP', value: row.xp.toLocaleString(), inline: true },
          { name: 'Messages counted', value: row.messages.toLocaleString(), inline: true },
          { name: 'Next level', value: `${Math.max(0, next - row.xp)} XP remaining`, inline: true }
        );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      const description = rows.length ? rows.map((r, i) => `**${i + 1}.** <@${r.user_id}> — level ${Math.floor(Math.sqrt(r.xp / 100))} (${r.xp.toLocaleString()} XP)`).join('\n') : 'No activity recorded yet. Send messages to start earning XP.';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x42B883).setTitle('🏆 Community leaderboard').setDescription(description)], allowedMentions: { parse: [] } });
    }
    return true;
  }

  if (name === 'giveaway') {
    if (!interaction.memberPermissions?.has(manageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const prize = interaction.options.getString('prize', true).trim();
    const minutes = interaction.options.getInteger('minutes', true);
    const winners = interaction.options.getInteger('winners', true);
    const endsAt = Date.now() + minutes * 60_000;
    const message = await interaction.channel.send({
      embeds: [new EmbedBuilder().setColor(0x42B883).setTitle('🎉 Giveaway').setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt / 1000)}:R>\n\nReact with 🎉 to enter!`).setFooter({ text: 'Meta Support • Giveaway' })],
      allowedMentions: { parse: [] }
    });
    await message.react('🎉');
    db.prepare('INSERT INTO community_giveaways (guild_id, channel_id, message_id, prize, winners, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(interaction.guildId, interaction.channelId, message.id, prize, winners, endsAt, interaction.user.id);
    await interaction.reply({ content: `Giveaway created: ${message.url}`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'giveaway-end') {
    if (!interaction.memberPermissions?.has(manageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const id = interaction.options.getString('message_id', true).trim();
    const giveaway = db.prepare('SELECT * FROM community_giveaways WHERE guild_id = ? AND message_id = ? AND ended = 0').get(interaction.guildId, id);
    if (!giveaway) {
      await interaction.reply({ content: 'No active giveaway found with that message ID.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await finishGiveaway(interaction.client, giveaway);
    await interaction.editReply('Giveaway ended.');
    return true;
  }

  if (name === 'role-menu') {
    if (!interaction.memberPermissions?.has(manageRoles)) {
      await interaction.reply({ content: 'You need Manage Roles permission.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const roles = [1,2,3,4,5].map(i => interaction.options.getRole('role' + i)).filter(Boolean);
    const botHighest = interaction.guild.members.me.roles.highest.position;
    if (roles.some(role => role.managed || role.position >= botHighest || role.id === interaction.guildId)) {
      await interaction.reply({ content: 'Every selectable role must be below my highest role and not managed by an integration.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const menu = new StringSelectMenuBuilder().setCustomId('meta_self_roles').setPlaceholder('Choose or remove your roles')
      .setMinValues(0).setMaxValues(roles.length)
      .addOptions(roles.map(role => ({ label: role.name.slice(0, 100), value: role.id, description: 'Toggle ' + role.name })));
    await interaction.channel.send({
      embeds: [new EmbedBuilder().setColor(0x42B883).setTitle(interaction.options.getString('title', true)).setDescription('Select the roles you want. Selecting a role you already have will remove it.')],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
    await interaction.reply({ content: 'Self-service role menu posted.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'serverstats') {
    const guild = interaction.guild;
    await guild.members.fetch().catch(() => null);
    const members = guild.members.cache;
    const embed = new EmbedBuilder().setColor(0x42B883).setTitle(`📊 ${guild.name} — Server statistics`)
      .addFields(
        { name: 'Members', value: String(guild.memberCount), inline: true },
        { name: 'Humans', value: String(members.filter(m => !m.user.bot).size), inline: true },
        { name: 'Bots', value: String(members.filter(m => m.user.bot).size), inline: true },
        { name: 'Text channels', value: String(guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size), inline: true },
        { name: 'Voice channels', value: String(guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size), inline: true },
        { name: 'Roles', value: String(guild.roles.cache.size), inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Boost level', value: String(guild.premiumTier), inline: true },
        { name: 'Boosts', value: String(guild.premiumSubscriptionCount || 0), inline: true }
      );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'config-export') {
    if (!isAdmin(interaction)) {
      await interaction.reply({ content: 'Only administrators can export bot settings.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const settings = db.prepare('SELECT setting_key, setting_value, updated_at FROM settings WHERE guild_id = ? ORDER BY setting_key').all(interaction.guildId);
    const safe = settings.map(row => ({ ...row, setting_value: /token|secret|password|api.?key/i.test(row.setting_key) ? '[REDACTED]' : row.setting_value }));
    const payload = Buffer.from(JSON.stringify({ guildId: interaction.guildId, exportedAt: new Date().toISOString(), settings: safe }, null, 2));
    await interaction.reply({ content: 'Settings export attached. Sensitive-looking values are redacted.', files: [{ attachment: payload, name: 'meta-support-settings.json' }], flags: MessageFlags.Ephemeral });
    return true;
  }
  return false;
}

async function finishGiveaway(client, giveaway) {
  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  let winners = [];
  if (channel?.isTextBased()) {
    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    const reaction = message?.reactions.cache.get('🎉');
    const users = reaction ? await reaction.users.fetch().catch(() => null) : null;
    winners = users ? [...users.values()].filter(user => !user.bot) : [];
    for (let i = winners.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [winners[i], winners[j]] = [winners[j], winners[i]];
    }
    winners = winners.slice(0, giveaway.winners);
    const text = winners.length ? winners.map(user => `<@${user.id}>`).join(', ') : 'No valid entries.';
    if (message) await message.reply({ content: `🎉 Giveaway ended! **${giveaway.prize}** winner(s): ${text}`, allowedMentions: { users: winners.map(user => user.id) } }).catch(() => {});
  }
  db.prepare('UPDATE community_giveaways SET ended = 1 WHERE id = ?').run(giveaway.id);
}

export async function runCommunityScheduler(client) {
  const due = db.prepare('SELECT * FROM community_giveaways WHERE ended = 0 AND ends_at <= ?').all(Date.now());
  for (const giveaway of due) {
    try { await finishGiveaway(client, giveaway); }
    catch (error) { console.error('Giveaway ending failed:', error.message); }
  }
}

export async function handleCommunityComponent(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'meta_self_roles') return false;
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Use this menu inside a server.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const selected = new Set(interaction.values);
  const validRoles = interaction.component.options.map(option => option.value);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const botHighest = interaction.guild.members.me.roles.highest.position;
  const add = [];
  const remove = [];
  for (const id of validRoles) {
    const role = await interaction.guild.roles.fetch(id).catch(() => null);
    if (!role || role.managed || role.position >= botHighest) continue;
    if (selected.has(id) && !member.roles.cache.has(id)) add.push(role);
    if (!selected.has(id) && member.roles.cache.has(id)) remove.push(role);
  }
  if (add.length) await member.roles.add(add, 'Member used Meta Support self-role menu');
  if (remove.length) await member.roles.remove(remove, 'Member used Meta Support self-role menu');
  await interaction.reply({ content: 'Your self-service roles have been updated.', flags: MessageFlags.Ephemeral });
  return true;
}

export async function handleCommunityEvents(client) {
  client.on('guildMemberAdd', async member => {
    const roleId = getSetting(member.guild.id, 'community_autorole_id');
    if (roleId) {
      const role = await member.guild.roles.fetch(roleId).catch(() => null);
      const botHighest = member.guild.members.me?.roles.highest.position ?? 0;
      if (role && !role.managed && role.position < botHighest) await member.roles.add(role, 'Configured Meta Support autorole').catch(error => console.error('Autorole failed:', error.message));
    }
    const channelId = getSetting(member.guild.id, 'community_welcome_channel_id');
    if (channelId) {
      const channel = await member.guild.channels.fetch(channelId).catch(() => null);
      const template = getSetting(member.guild.id, 'community_welcome_message') || 'Welcome {user} to {server}! You are member #{membercount}.';
      const message = template.replaceAll('{user}', member.toString()).replaceAll('{server}', member.guild.name).replaceAll('{membercount}', String(member.guild.memberCount));
      if (channel?.isTextBased()) {
        const avatarUrl = member.displayAvatarURL({ size: 256, extension: 'png' });
        const showAvatar = getSetting(member.guild.id, 'community_welcome_avatar') !== 'false';
        const welcomeEmbed = new EmbedBuilder().setColor(0x42B883)
          .setAuthor({ name: 'Welcome ' + member.user.username, ...(showAvatar ? { iconURL: avatarUrl } : {}) })
          .setDescription(message)
          .setFooter({ text: member.guild.name + ' • Member #' + member.guild.memberCount })
          .setTimestamp();
        if (showAvatar) welcomeEmbed.setThumbnail(avatarUrl);
        await channel.send({ embeds: [welcomeEmbed], allowedMentions: { users: [member.id] } }).catch(error => console.error('Welcome message failed:', error.message));
      }
    }
    await sendLog(member.guild, new EmbedBuilder().setColor(0x42B883).setTitle('Member joined').setDescription(`${member.user.tag} (${member.id})`).setTimestamp());
  });
  client.on('guildMemberRemove', member => {
    void sendLog(member.guild, new EmbedBuilder().setColor(0xD97757).setTitle('Member left').setDescription(`${member.user?.tag || member.id} (${member.id})`).setTimestamp());
  });
  client.on('messageCreate', message => {
    if (!message.guild || message.author.bot) return;
    if (getSetting(message.guild.id, 'community_xp_enabled') === 'false') return;
    const now = Date.now();
    const row = db.prepare('SELECT xp, last_message_at FROM community_xp WHERE guild_id = ? AND user_id = ?').get(message.guild.id, message.author.id);
    if (row && now - row.last_message_at < 60_000) return;
    const earned = 10 + Math.floor(Math.random() * 11);
    db.prepare(`INSERT INTO community_xp (guild_id, user_id, xp, messages, last_message_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = xp + excluded.xp, messages = messages + 1, last_message_at = excluded.last_message_at`)
      .run(message.guild.id, message.author.id, earned, now);
  });
  client.on('messageDelete', message => {
    if (!message.guild || !message.author || message.author.bot) return;
    void sendLog(message.guild, new EmbedBuilder().setColor(0xD97757).setTitle('Message deleted')
      .setDescription(`Author: <@${message.author.id}>\nChannel: <#${message.channelId}>\nContent: ${(message.content || '[content unavailable]').slice(0, 2500)}`)
      .setTimestamp());
  });
  client.on('channelCreate', channel => {
    if (channel.guild) void sendLog(channel.guild, new EmbedBuilder().setColor(0x42B883).setTitle('Channel created').setDescription(`${channel.name} (${channel.id})`).setTimestamp());
  });
  client.on('channelDelete', channel => {
    if (channel.guild) void sendLog(channel.guild, new EmbedBuilder().setColor(0xD97757).setTitle('Channel deleted').setDescription(`${channel.name} (${channel.id})`).setTimestamp());
  });
}

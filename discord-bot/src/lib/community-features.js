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
    .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (1–10)').setMinValue(1).setMaxValue(10).setRequired(false)),
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

function embedColor(guildId, fallback = 0x42B883) {
  const value = Number(getSetting(guildId, 'bot_embed_color'));
  return Number.isInteger(value) && value >= 0 && value <= 0xFFFFFF ? value : fallback;
}

function embedFooter(guildId, fallback = 'Meta Code Community') {
  return getSetting(guildId, 'bot_embed_footer') || fallback;
}

function logChannelId(guildId) {
  return getSetting(guildId, 'community_log_channel_id');
}

async function sendLog(guild, embed, eventName) {
  if (getSetting(guild.id, 'community_log_enabled') === 'false') return;
  const rawEvents = getSetting(guild.id, 'community_log_events');
  if (rawEvents) {
    try {
      const events = JSON.parse(rawEvents);
      if (Array.isArray(events) && events.length && eventName && !events.includes(eventName)) return;
    } catch { /* retain the legacy all-events behavior if the setting is malformed */ }
  }
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
    if (name === 'leaderboard' && getSetting(interaction.guildId, 'community_leaderboard_enabled') === 'false') {
      await interaction.reply({ content: 'The activity leaderboard is disabled in this server.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const rows = db.prepare('SELECT user_id, xp, messages FROM community_xp WHERE guild_id = ? ORDER BY xp DESC LIMIT 10').all(interaction.guildId);
    if (name === 'level') {
      const user = interaction.options.getUser('user') || interaction.user;
      const row = db.prepare('SELECT xp, messages FROM community_xp WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, user.id) || { xp: 0, messages: 0 };
      const level = Math.floor(Math.sqrt(row.xp / 100));
      const next = (level + 1) ** 2 * 100;
      const embed = new EmbedBuilder() .setColor(embedColor(interaction.guildId)).setTitle(`Activity profile: ${user.username}`)
        .addFields(
          { name: 'Level', value: String(level), inline: true },
          { name: 'XP', value: row.xp.toLocaleString(), inline: true },
          { name: 'Messages counted', value: row.messages.toLocaleString(), inline: true },
          { name: 'Next level', value: `${Math.max(0, next - row.xp)} XP remaining`, inline: true }
        );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      const description = rows.length ? rows.map((r, i) => `**${i + 1}.** <@${r.user_id}> — level ${Math.floor(Math.sqrt(r.xp / 100))} (${r.xp.toLocaleString()} XP)`).join('\n') : 'No activity recorded yet. Send messages to start earning XP.';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(embedColor(interaction.guildId)).setTitle('🏆 Community leaderboard').setFooter({ text: embedFooter(interaction.guildId) }).setDescription(description)], allowedMentions: { parse: [] } });
    }
    return true;
  }

  if (name === 'giveaway') {
    if (getSetting(interaction.guildId, 'community_giveaway_enabled') === 'false') {
      await interaction.reply({ content: 'Giveaways are disabled in this server.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!interaction.memberPermissions?.has(manageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const prize = interaction.options.getString('prize', true).trim();
    const minutes = interaction.options.getInteger('minutes', true);
    const winners = interaction.options.getInteger('winners') ?? Math.max(1, Math.min(10, Number(getSetting(interaction.guildId, 'community_giveaway_default_winners') || 1)));
    const endsAt = Date.now() + minutes * 60_000;
    const message = await interaction.channel.send({
      embeds: [new EmbedBuilder().setColor(embedColor(interaction.guildId)).setTitle('🎉 Giveaway').setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt / 1000)}:R>\n\nReact with 🎉 to enter!`).setFooter({ text: embedFooter(interaction.guildId, 'Meta Code Community • Giveaway') })],
      allowedMentions: { parse: [] }
    });
    await message.react('🎉');
    db.prepare('INSERT INTO community_giveaways (guild_id, channel_id, message_id, prize, winners, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(interaction.guildId, interaction.channelId, message.id, prize, winners, endsAt, interaction.user.id);
    await interaction.reply({ content: `Giveaway created: ${message.url}`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'giveaway-end') {
    if (getSetting(interaction.guildId, 'community_giveaway_allow_early_end') === 'false') {
      await interaction.reply({ content: 'Early giveaway endings are disabled by the server template.', flags: MessageFlags.Ephemeral });
      return true;
    }
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
    if (getSetting(interaction.guildId, 'community_self_roles_enabled') === 'false') {
      await interaction.reply({ content: 'Self-service roles are disabled in this server.', flags: MessageFlags.Ephemeral });
      return true;
    }
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
    const allowMultiple = getSetting(interaction.guildId, 'community_self_roles_allow_multiple') !== 'false';
    const menu = new StringSelectMenuBuilder().setCustomId('meta_self_roles').setPlaceholder('Choose or remove your roles')
      .setMinValues(allowMultiple ? 0 : Math.min(1, roles.length)).setMaxValues(allowMultiple ? roles.length : Math.min(1, roles.length))
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
  if (getSetting(interaction.guildId, 'community_self_roles_enabled') === 'false') {
    await interaction.reply({ content: 'Self-service roles are disabled in this server.', flags: MessageFlags.Ephemeral });
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
    if (channelId && getSetting(member.guild.id, 'community_welcome_enabled') !== 'false') {
      const channel = await member.guild.channels.fetch(channelId).catch(() => null);
      const template = getSetting(member.guild.id, 'community_welcome_message') || 'Welcome {user} to {server}! You are member #{membercount}.';
      const message = template.replaceAll('{user}', member.toString()).replaceAll('{server}', member.guild.name).replaceAll('{membercount}', String(member.guild.memberCount));
      if (channel?.isTextBased()) {
        const showAvatar = getSetting(member.guild.id, 'community_welcome_avatar') !== 'false';
        const welcome = new EmbedBuilder()
          .setColor(embedColor(member.guild.id))
          .setTitle('Welcome to ' + member.guild.name)
          .setDescription(message)
          .setAuthor({ name: member.user.tag, ...(showAvatar ? { iconURL: member.user.displayAvatarURL({ size: 128 }) } : {}) })
          .setFooter({ text: embedFooter(member.guild.id) })
          .setTimestamp();
        if (showAvatar) welcome.setThumbnail(member.user.displayAvatarURL({ size: 512 }));
        await channel.send({ embeds: [welcome], allowedMentions: { users: [member.id] } }).catch(error => console.error('Welcome message failed:', error.message));
      }
    }
    await sendLog(member.guild, new EmbedBuilder().setColor(embedColor(member.guild.id)).setTitle('Member joined').setDescription(`${member.user.tag} (${member.id})`).setTimestamp(), 'member_join');
  });
  client.on('guildMemberRemove', member => {
    void sendLog(member.guild, new EmbedBuilder().setColor(embedColor(member.guild.id, 0xD97757)).setTitle('Member left').setDescription(`${member.user?.tag || member.id} (${member.id})`).setTimestamp(), 'member_leave');
  });
  const automodActivity = new Map();
  client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    const guildId = message.guild.id;
    const now = Date.now();
    const key = guildId + ':' + message.author.id;
    const configEnabled = getSetting(guildId, 'automod_enabled') !== 'false';
    if (configEnabled) {
      const prior = automodActivity.get(key) || { times: [], lastText: '', lastTextAt: 0 };
      prior.times = prior.times.filter(time => now - time < 8_000);
      prior.times.push(now);
      const mentionLimit = Math.max(1, Math.min(50, Number(getSetting(guildId, 'automod_mention_limit') || 5)));
      const mentionCount = message.mentions.users.size + message.mentions.roles.size;
      const tooManyMentions = mentionCount > mentionLimit;
      const spam = getSetting(guildId, 'automod_anti_spam') === 'true' && prior.times.length > 5;
      const cleanText = typeof message.content === 'string' ? message.content.trim().toLowerCase() : '';
      const duplicate = getSetting(guildId, 'automod_duplicate_filter') === 'true' &&
        cleanText.length > 0 && cleanText === prior.lastText && now - prior.lastTextAt < 30_000;
      const invite = getSetting(guildId, 'automod_invite_filter') === 'true' &&
        /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(cleanText);
      if (tooManyMentions || spam || duplicate || invite) {
        await message.delete().catch(() => {});
        if (tooManyMentions) await message.channel.send({ content: message.author.toString() + ', your message was removed because it exceeded the mention limit.' }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
        prior.lastTextAt = now;
        automodActivity.set(key, prior);
        return;
      }
      if (cleanText) {
        prior.lastText = cleanText;
        prior.lastTextAt = now;
      }
      automodActivity.set(key, prior);
      if (automodActivity.size > 5000) {
        for (const [activityKey, value] of automodActivity) if (now - (value.times.at(-1) || 0) > 60_000) automodActivity.delete(activityKey);
      }
    }

    if (getSetting(guildId, 'community_xp_enabled') === 'false') return;
    const row = db.prepare('SELECT xp, last_message_at FROM community_xp WHERE guild_id = ? AND user_id = ?').get(guildId, message.author.id);
    const cooldownSeconds = Math.max(1, Math.min(3600, Number(getSetting(guildId, 'community_xp_cooldown_seconds') || 60)));
    if (row && now - row.last_message_at < cooldownSeconds * 1000) return;
    const configuredXp = Number(getSetting(guildId, 'community_xp_per_message') || 10);
    const earned = Number.isInteger(configuredXp) && configuredXp >= 1 && configuredXp <= 1000 ? configuredXp : 10;
    const previousLevel = Math.floor(Math.sqrt((row?.xp || 0) / 100));
    db.prepare(`INSERT INTO community_xp (guild_id, user_id, xp, messages, last_message_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = xp + excluded.xp, messages = messages + 1, last_message_at = excluded.last_message_at`)
      .run(guildId, message.author.id, earned, now);
    const currentRow = db.prepare('SELECT xp FROM community_xp WHERE guild_id = ? AND user_id = ?').get(guildId, message.author.id);
    const currentLevel = Math.floor(Math.sqrt(currentRow.xp / 100));
    if (currentLevel > previousLevel && getSetting(guildId, 'community_level_up_messages') !== 'false') {
      await message.channel.send({ content: '🎉 ' + message.author.toString() + ' reached level **' + currentLevel + '**!' }).catch(() => {});
    }
  });
  client.on('messageDelete', message => {
    if (!message.guild || !message.author || message.author.bot) return;
    void sendLog(message.guild, new EmbedBuilder().setColor(embedColor(message.guild.id, 0xD97757)).setTitle('Message deleted')
      .setDescription(`Author: <@${message.author.id}>\nChannel: <#${message.channelId}>\nContent: ${(message.content || '[content unavailable]').slice(0, 2500)}`)
      .setTimestamp(), 'message_delete');
  });
  client.on('channelCreate', channel => {
    if (channel.guild) void sendLog(channel.guild, new EmbedBuilder().setColor(embedColor(channel.guild.id)).setTitle('Channel created').setDescription(`${channel.name} (${channel.id})`).setTimestamp(), 'channel_create');
  });
  client.on('channelDelete', channel => {
    if (channel.guild) void sendLog(channel.guild, new EmbedBuilder().setColor(embedColor(channel.guild.id, 0xD97757)).setTitle('Channel deleted').setDescription(`${channel.name} (${channel.id})`).setTimestamp(), 'channel_delete');
  });
}

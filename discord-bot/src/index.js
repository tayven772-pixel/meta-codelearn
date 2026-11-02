import 'dotenv/config';
import { createHash } from 'node:crypto';
import { ticketCommand } from './lib/ticket-commands.js';
import { serverSetupCommand } from './lib/server-setup.js';
import { handleTicketCommand, handleTicketButton, handleTicketPanelCommand, runPendingTicketDeletions } from './lib/tickets.js';
import { staffApplicationCommands, handleStaffApplicationCommand, handleStaffApplicationComponent } from './lib/applications.js';
import { applyServerTemplate, previewServerTemplate, handleServerSetup, handleServerSetupButton } from './lib/server-setup.js';
import { db, getSetting } from './lib/database.js';
import { moderationCommands, handleModerationCommand } from './lib/moderation.js';
import { autoPartnerCommands, handleAutoPartnerCommand, runAutoPartnerScheduler } from './lib/autopartner.js';
import { communityCommands, handleCommunityCommand, handleCommunityComponent, handleCommunityEvents, runCommunityScheduler } from './lib/community-features.js';
import { ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, GatewayIntentBits, MessageFlags, Partials, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
const siteUrl = (process.env.META_SITE_URL || 'https://metasupportcom.dbm.shared-servers.com').replace(/\/$/, '');
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token || !clientId) { console.error('Missing bot token or client ID in .env'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages], partials: [Partials.Channel] });
const commands = [
 new SlashCommandBuilder().setName('meta').setDescription('Open Meta CodeLearn and explore coding lessons'),
 new SlashCommandBuilder().setName('lessons').setDescription('Get Meta CodeLearn learning links'),
 new SlashCommandBuilder().setName('ping').setDescription('Check whether the Meta bot is online'),
 new SlashCommandBuilder().setName('security-test').setDescription('Send a security alert test DM to the bot owner'),
 new SlashCommandBuilder().setName('membercount').setDescription('Show this server’s member count'),
 new SlashCommandBuilder().setName('avatar').setDescription('Show a member’s avatar')
  .addUserOption(option => option.setName('user').setDescription('Member (defaults to you)').setRequired(false)),
 new SlashCommandBuilder().setName('roleinfo').setDescription('Show details about a server role')
  .addRoleOption(option => option.setName('role').setDescription('Role to inspect').setRequired(true)),
 new SlashCommandBuilder().setName('slowmode').setDescription('Set this channel’s slowmode (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addIntegerOption(option => option.setName('seconds').setDescription('Seconds between messages (0–21600)').setMinValue(0).setMaxValue(21600).setRequired(true)),
 new SlashCommandBuilder().setName('lock').setDescription('Lock this text channel for @everyone (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
 new SlashCommandBuilder().setName('unlock').setDescription('Unlock this text channel for @everyone (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
 new SlashCommandBuilder().setName('embed').setDescription('Post a formatted announcement embed (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option => option.setName('title').setDescription('Announcement title').setMaxLength(200).setRequired(true))
  .addStringOption(option => option.setName('message').setDescription('Announcement text').setMaxLength(3500).setRequired(true))
  .addStringOption(option => option.setName('color').setDescription('Hex color such as #42B883').setRequired(false)),
 new SlashCommandBuilder().setName('thread').setDescription('Start a focused public discussion thread')
  .addStringOption(option => option.setName('name').setDescription('Thread title').setMaxLength(100).setRequired(true))
  .addStringOption(option => option.setName('message').setDescription('Opening message').setMaxLength(1500).setRequired(false)),
 new SlashCommandBuilder().setName('topic').setDescription('Update this channel topic (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(option => option.setName('text').setDescription('New channel topic (leave empty to clear)').setMaxLength(1024).setRequired(false)),
 new SlashCommandBuilder().setName('randomcolor').setDescription('Generate a random color and hex code'),
 new SlashCommandBuilder().setName('remindme').setDescription('Send yourself a reminder by DM')
  .addIntegerOption(option => option.setName('minutes').setDescription('When to remind you (1–1440 minutes)').setMinValue(1).setMaxValue(1440).setRequired(true))
  .addStringOption(option => option.setName('reminder').setDescription('What should I remind you about?').setMaxLength(180).setRequired(true)),
 new SlashCommandBuilder().setName('help').setDescription('Show Meta bot commands and community tools'),
 new SlashCommandBuilder().setName('serverinfo').setDescription('Show useful information about this server'),
 new SlashCommandBuilder().setName('userinfo').setDescription('Show information about a server member')
  .addUserOption(option => option.setName('user').setDescription('Member to look up (defaults to you)').setRequired(false)),
 new SlashCommandBuilder().setName('poll').setDescription('Create a quick reaction poll')
  .addStringOption(option => option.setName('question').setDescription('What are you asking?').setMaxLength(250).setRequired(true))
  .addStringOption(option => option.setName('option1').setDescription('First option').setMaxLength(80).setRequired(true))
  .addStringOption(option => option.setName('option2').setDescription('Second option').setMaxLength(80).setRequired(true))
  .addStringOption(option => option.setName('option3').setDescription('Third option (optional)').setMaxLength(80).setRequired(false))
  .addStringOption(option => option.setName('option4').setDescription('Fourth option (optional)').setMaxLength(80).setRequired(false))
  .addStringOption(option => option.setName('option5').setDescription('Fifth option (optional)').setMaxLength(80).setRequired(false)),
 new SlashCommandBuilder().setName('suggest').setDescription('Post a suggestion for the community')
  .addStringOption(option => option.setName('idea').setDescription('Your suggestion for the server or Meta').setMaxLength(1000).setRequired(true)),
 new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
 new SlashCommandBuilder().setName('roll').setDescription('Roll a number between two limits')
  .addIntegerOption(option => option.setName('min').setDescription('Lowest possible number').setMinValue(-1000000).setMaxValue(1000000).setRequired(false))
  .addIntegerOption(option => option.setName('max').setDescription('Highest possible number').setMinValue(-1000000).setMaxValue(1000000).setRequired(false)),
 new SlashCommandBuilder().setName('choose').setDescription('Choose one item from a comma-separated list')
  .addStringOption(option => option.setName('options').setDescription('Items separated by commas').setMaxLength(1000).setRequired(true)),
 new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball a question')
  .addStringOption(option => option.setName('question').setDescription('Your question').setMaxLength(250).setRequired(true)),
 new SlashCommandBuilder().setName('announce').setDescription('Post an official server announcement').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option => option.setName('message').setDescription('Announcement text').setMaxLength(1800).setRequired(true)),
 ticketCommand,
 serverSetupCommand,
 ...moderationCommands.map(command => ({ toJSON: () => command })),
 ...autoPartnerCommands.map(command => ({ toJSON: () => command })),
 ...communityCommands.map(command => ({ toJSON: () => command })),
 ...staffApplicationCommands.map(command => ({ toJSON: () => command })),
].map(command => command.toJSON());
client.once(Events.ClientReady, async readyClient => {
 console.log(`Meta bot ready as ${readyClient.user.tag}`);
 const homeGuildId = String(process.env.META_HOME_GUILD_ID || process.env.DISCORD_GUILD_ID || '').trim();
 const hasConfiguredHomeGuild = /^\d{17,20}$/.test(homeGuildId);
 const upsertGuildPresence = db.prepare(`INSERT INTO bot_guild_presence (guild_id, name, icon, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(guild_id) DO UPDATE SET name=excluded.name, icon=excluded.icon, updated_at=CURRENT_TIMESTAMP`);
 const syncBotGuilds = () => {
  if (!hasConfiguredHomeGuild) {
   console.warn('Meta home server is not configured; set DISCORD_GUILD_ID in the bot environment.');
   return;
  }
  const sync = db.transaction(() => {
   const homeGuild = readyClient.guilds.cache.get(homeGuildId);
   if (homeGuild) upsertGuildPresence.run(homeGuild.id, homeGuild.name, homeGuild.icon);
   const existing = db.prepare('SELECT guild_id FROM bot_guild_presence').all();
   const remove = db.prepare('DELETE FROM bot_guild_presence WHERE guild_id=?');
   for (const row of existing) if (row.guild_id !== homeGuildId) remove.run(row.guild_id);
  });
  sync();
 };
 if (hasConfiguredHomeGuild) {
  for (const guild of readyClient.guilds.cache.values()) {
   if (guild.id !== homeGuildId) {
    console.log(`Leaving unconfigured server ${guild.name} (${guild.id}); Meta bot is restricted to its home server.`);
    await guild.leave().catch(error => console.error(`Could not leave server ${guild.id}:`, error.message));
   }
  }
 }
 syncBotGuilds();
 const recordGuildPresence = guild => upsertGuildPresence.run(guild.id, guild.name, guild.icon);
 readyClient.on(Events.GuildCreate, guild => {
  if (hasConfiguredHomeGuild && guild.id !== homeGuildId) {
   console.log(`Leaving server ${guild.name} (${guild.id}); only the Meta home server is supported.`);
   void guild.leave().catch(error => console.error(`Could not leave server ${guild.id}:`, error.message));
   return;
  }
  recordGuildPresence(guild);
  console.log(`Meta home server connected: ${guild.name} (${guild.id}).`);
 });
 readyClient.on(Events.GuildDelete, guild => {
  db.prepare('DELETE FROM bot_guild_presence WHERE guild_id=?').run(guild.id);
 });

 const applyConfiguredPresence = () => {
  const configuredStatus = getSetting('global', 'bot_status_text')?.trim();
  readyClient.user.setPresence({
   activities: configuredStatus ? [{ name: configuredStatus.slice(0, 128), type: ActivityType.Playing }] : [],
   status: 'online'
  });
 };
 applyConfiguredPresence();
 runAutoPartnerScheduler(readyClient).catch(error => console.error('Autopartner startup check failed:', error.message));
 runPendingTicketDeletions(readyClient, db).catch(error => console.error('Ticket deletion recovery failed:', error.message));
 setInterval(() => runPendingTicketDeletions(readyClient, db).catch(error => console.error('Ticket deletion scheduler failed:', error.message)), 1000).unref();
 setInterval(() => {
  try { applyConfiguredPresence(); }
  catch (error) { console.error('Bot presence refresh failed:', error.message); }
  runAutoPartnerScheduler(readyClient).catch(error => console.error('Autopartner scheduler failed:', error.message));
  runCommunityScheduler(readyClient).catch(error => console.error('Community scheduler failed:', error.message));
 }, 60_000).unref();
 try {
  // Register commands globally so the bot works in every server it is invited to.
  // Global commands can take a little while to appear in Discord.
  await readyClient.application.commands.set(commands);
  // Remove legacy guild-only copies from the previously configured server, if present.
  if (guildId) {
   await readyClient.application.commands.set([], guildId).catch(error =>
    console.warn('Could not clear legacy server-only commands:', error.message)
   );
  }
  console.log('Registered Meta CodeLearn slash commands globally for all servers.');
 }
 catch (error) { console.error('Command registration failed:', error.message); }
});
client.on(Events.InteractionCreate, async interaction => {
 try {
  if (interaction.isChatInputCommand()) {
   if (interaction.inGuild() && getSetting(interaction.guildId, 'bot_command_enabled:' + interaction.commandName) === 'false') {
    await interaction.reply({ content: 'This command is currently disabled by the server owner in the Meta Code bot dashboard.', flags: MessageFlags.Ephemeral });
    return;
   }
   if (await handleAutoPartnerCommand(interaction)) return;
   if (await handleModerationCommand(interaction)) return;
   if (await handleCommunityCommand(interaction)) return;
   if (await handleStaffApplicationCommand(interaction)) return;
   if (interaction.commandName === 'setup-server') {
    await handleServerSetup(interaction);
    return;
   }
     if (interaction.commandName === 'ticket') {
      await handleTicketCommand(interaction, db);
      return;
     }
   if (interaction.commandName === 'help') {
    const customHelp = interaction.inGuild() ? getSetting(interaction.guildId, 'bot_response:help') : null;
    if (customHelp) { await interaction.reply({ content: customHelp.replaceAll('{siteUrl}', siteUrl), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }); return; }
    const embed = new EmbedBuilder()
     .setColor(0x42B883)
     .setTitle('Meta Bot | Command Guide')
     .setDescription('Helpful tools for the Meta Code community.')
     .addFields(
      { name: 'Learning', value: '`/meta` — website, projects and account links\n`/lessons` — jump into coding lessons\n`/remindme` — DM yourself a reminder\n`/randomcolor` — generate a color code', inline: false },
      { name: 'Community', value: '`/poll` — create a reaction poll\n`/suggest` — share an idea\n`/coinflip` — flip a coin\n`/roll` — random number\n`/choose` — choose from a list\n`/8ball` — playful answer\n`/serverinfo` — server details\n`/userinfo` — member details\n`/ping` — check bot status\n`/membercount` — server member totals\n`/avatar` — view an avatar\n`/roleinfo` — inspect a role\n`/thread` — start a discussion\n`/topic` — update a channel topic (staff)', inline: false },
      { name: 'Moderation', value: '`/warn` and `/warnings` — record and review warnings\n`/timeout` and `/untimeout` — manage member timeouts\n`/purge` — delete up to 100 recent messages (staff permissions required)', inline: false },
      { name: 'Administrator', value: '`/announce` — post an official announcement (administrators only)\n`/embed` — post a formatted announcement\n`/lock`, `/unlock`, `/slowmode` — manage a text channel', inline: false },
      { name: 'Partnerships', value: '/autopartner-setup, /partner-add, /partner-remove, /partner-list, /partner-settings, /partner-template, /partner-post', inline: false },
      { name: 'Community expansion', value: '`/welcome-config` — welcome messages\n`/autorole` — automatic join role\n`/logging` — event log channel\n`/level` and `/leaderboard` — activity XP\n`/giveaway` and `/giveaway-end` — giveaways\n`/role-menu` — self-service roles\n`/serverstats` — server analytics\n`/config-export` — export settings', inline: false },
      { name: 'Staff tools', value: '`/ticket`, `/ticket-panel`, `/setup-server`, `/setup-applications` — availability depends on your server permissions and bot setup.', inline: false }
     )
     .setFooter({ text: 'Meta Code • Learn the idea, then the code' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'membercount') {
    if (!interaction.inGuild()) {
     await interaction.reply({ content: 'Use this command inside a server.', flags: MessageFlags.Ephemeral });
     return;
    }
    const guild = interaction.guild;
    const counts = await guild.fetch().catch(() => guild);
    await interaction.reply({
     embeds: [new EmbedBuilder().setColor(0x42B883).setTitle(`👥 ${guild.name} member count`)
      .addFields(
       { name: 'Total members', value: String(counts.memberCount ?? guild.memberCount), inline: true },
       { name: 'Server created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true }
      ).setTimestamp()],
     flags: MessageFlags.Ephemeral
    });
   }
   else if (interaction.commandName === 'avatar') {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const url = user.displayAvatarURL({ size: 1024, extension: 'png' });
    const embed = new EmbedBuilder().setColor(0x42B883).setTitle(`${user.username}’s avatar`).setImage(url).setURL(url);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'roleinfo') {
    if (!interaction.inGuild()) {
     await interaction.reply({ content: 'Use this command inside a server.', flags: MessageFlags.Ephemeral });
     return;
    }
    const role = interaction.options.getRole('role', true);
    const embed = new EmbedBuilder().setColor(role.color || 0x42B883).setTitle(`Role: ${role.name}`)
     .addFields(
      { name: 'Members', value: String(role.members.size), inline: true },
      { name: 'Position', value: String(role.position), inline: true },
      { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
      { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
      { name: 'Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
      { name: 'Role ID', value: role.id, inline: false }
     );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
   }
   else if (['lock', 'unlock', 'slowmode'].includes(interaction.commandName)) {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
     await interaction.reply({ content: 'You need Manage Channels permission to use this command.', flags: MessageFlags.Ephemeral });
     return;
    }
    const channel = interaction.channel;
    if (!channel?.isTextBased() || !channel.permissionOverwrites?.edit || typeof channel.setRateLimitPerUser !== 'function') {
     await interaction.reply({ content: 'This command only works in a standard server text channel.', flags: MessageFlags.Ephemeral });
     return;
    }
    if (interaction.commandName === 'slowmode') {
     const seconds = interaction.options.getInteger('seconds', true);
     await channel.setRateLimitPerUser(seconds, `Slowmode updated by ${interaction.user.tag}`);
     await interaction.reply({ content: seconds === 0 ? '✅ Slowmode disabled.' : `🐢 Slowmode set to **${seconds} seconds**.`, flags: MessageFlags.Ephemeral });
    } else {
     const locked = interaction.commandName === 'lock';
     await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: locked ? false : null }, { reason: `Channel ${locked ? 'locked' : 'unlocked'} by ${interaction.user.tag}` });
     await interaction.reply({ content: locked ? '🔒 Channel locked for @everyone.' : '🔓 Channel unlocked for @everyone.', flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
   }
   else if (interaction.commandName === 'embed') {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
     await interaction.reply({ content: 'Only server administrators can post formatted announcements.', flags: MessageFlags.Ephemeral });
     return;
    }
    const title = interaction.options.getString('title', true).trim();
    const message = interaction.options.getString('message', true).trim();
    const rawColor = interaction.options.getString('color')?.trim();
    const color = rawColor ? Number.parseInt(rawColor.replace(/^#/, ''), 16) : 0x42B883;
    if (rawColor && (!/^(?:#)?[0-9a-fA-F]{6}$/.test(rawColor) || !Number.isInteger(color) || color < 0 || color > 0xFFFFFF)) {
     await interaction.reply({ content: 'Use a valid six-digit hex color, for example #42B883.', flags: MessageFlags.Ephemeral });
     return;
    }
    const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(message).setFooter({ text: `Meta Code • Posted by ${interaction.user.username}` }).setTimestamp();
    await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    await interaction.reply({ content: 'Formatted announcement posted.', flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'serverinfo') {
    if (!interaction.inGuild()) {
     await interaction.reply({ content: 'Use this command inside a server.', flags: MessageFlags.Ephemeral });
     return;
    }
    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const embed = new EmbedBuilder()
     .setColor(0x42B883)
     .setTitle(guild.name)
     .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
     .addFields(
      { name: 'Owner', value: owner ? `${owner.user.tag}` : 'Unavailable', inline: true },
      { name: 'Members', value: String(guild.memberCount), inline: true },
      { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
      { name: 'Server ID', value: guild.id, inline: true },
      { name: 'Boosts', value: String(guild.premiumSubscriptionCount ?? 0), inline: true }
     );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'userinfo') {
    if (!interaction.inGuild()) {
     await interaction.reply({ content: 'Use this command inside a server.', flags: MessageFlags.Ephemeral });
     return;
    }
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.guild.members.cache.get(user.id) ?? await interaction.guild.members.fetch(user.id).catch(() => null);
    const roles = member ? member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => role.toString()).slice(0, 10) : [];
    const embed = new EmbedBuilder()
     .setColor(0x42B883)
     .setTitle(`Member: ${user.username}`)
     .setThumbnail(user.displayAvatarURL({ size: 256 }))
     .addFields(
      { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
      { name: 'Joined server', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'Not available', inline: true },
      { name: 'Roles', value: roles.length ? roles.join(' ') : 'No additional roles shown', inline: false },
      { name: 'User ID', value: user.id, inline: false }
     );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'poll') {
    if (!interaction.inGuild() || !interaction.channel?.isTextBased()) {
     await interaction.reply({ content: 'Create polls in a server text channel.', flags: MessageFlags.Ephemeral });
     return;
    }
    const question = interaction.options.getString('question', true);
    const options = ['option1', 'option2', 'option3', 'option4', 'option5']
     .map(name => interaction.options.getString(name))
     .filter(Boolean);
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    const embed = new EmbedBuilder()
     .setColor(0x5865F2)
     .setTitle('📊 Community Poll')
     .setDescription(`**${question}**\n\n${options.map((option, index) => `${emojis[index]}  ${option}`).join('\n')}\n\n*React below to vote.*`)
     .setFooter({ text: `Poll by ${interaction.user.username} • Meta Code` })
     .setTimestamp();
    const message = await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    for (let index = 0; index < options.length; index++) await message.react(emojis[index]);
    await interaction.reply({ content: 'Your poll is live!', flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'suggest') {
    if (!interaction.inGuild() || !interaction.channel?.isTextBased()) {
     await interaction.reply({ content: 'Post suggestions in a server text channel.', flags: MessageFlags.Ephemeral });
     return;
    }
    const idea = interaction.options.getString('idea', true);
    const embed = new EmbedBuilder()
     .setColor(0x42B883)
     .setTitle('💡 Community Suggestion')
     .setDescription(idea)
     .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
     .setFooter({ text: 'React to support this idea • Meta Code' })
     .setTimestamp();
    const message = await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    await message.react('👍');
    await message.react('👎');
    await interaction.reply({ content: 'Suggestion posted — thanks for helping improve the community!', flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'coinflip') {
    await interaction.reply({ content: `🪙 **${Math.random() < 0.5 ? 'Heads' : 'Tails'}!**`, flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'roll') {
    const min = interaction.options.getInteger('min') ?? 1;
    const max = interaction.options.getInteger('max') ?? 100;
    if (min > max) { await interaction.reply({ content: 'The minimum must be less than or equal to the maximum.', flags: MessageFlags.Ephemeral }); return; }
    await interaction.reply({ content: `🎲 You rolled **${Math.floor(Math.random() * (max - min + 1)) + min}** (${min}–${max}).`, flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'choose') {
    const options = interaction.options.getString('options', true).split(',').map(value => value.trim()).filter(Boolean);
    if (options.length < 2) { await interaction.reply({ content: 'Give me at least two choices separated by commas.', flags: MessageFlags.Ephemeral }); return; }
    await interaction.reply({ content: `🎯 I choose: **${options[Math.floor(Math.random() * options.length)].slice(0, 180)}**`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
   }
   else if (interaction.commandName === '8ball') {
    const answers = ['It looks likely.', 'Signs point to yes.', 'Ask again later.', 'I cannot predict that one.', 'Probably not.', 'The outlook is uncertain.', 'Absolutely!', 'Not looking likely.'];
    await interaction.reply({ content: `🎱 **${answers[Math.floor(Math.random() * answers.length)]}**`, flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'announce') {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: 'Only server administrators can post official announcements.', flags: MessageFlags.Ephemeral }); return; }
    const message = interaction.options.getString('message', true);
    const embed = new EmbedBuilder().setColor(0x42B883).setTitle('📣 Meta Code Announcement').setDescription(message).setFooter({ text: `Posted by ${interaction.user.username}` }).setTimestamp();
    await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    await interaction.reply({ content: 'Announcement posted.', flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'thread') {
    if (!interaction.inGuild() || !interaction.channel?.isTextBased() || !interaction.channel.threads || typeof interaction.channel.send !== 'function') { await interaction.reply({ content: 'Use this command in a standard server text channel.', flags: MessageFlags.Ephemeral }); return; }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.CreatePublicThreads) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads)) { await interaction.reply({ content: 'You need Create Public Threads or Manage Threads permission.', flags: MessageFlags.Ephemeral }); return; }
    const name = interaction.options.getString('name', true).trim();
    const opening = interaction.options.getString('message')?.trim() || ('Discussion started by ' + interaction.user.username + '.');
    const starter = await interaction.channel.send({ content: '🧵 **' + name + '**\n' + opening, allowedMentions: { parse: [] } });
    const thread = await starter.startThread({ name, autoArchiveDuration: 1440, reason: 'Thread requested by ' + interaction.user.tag });
    await interaction.reply({ content: 'Created discussion: <#' + thread.id + '>', flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'topic') {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) { await interaction.reply({ content: 'You need Manage Channels permission to edit a channel topic.', flags: MessageFlags.Ephemeral }); return; }
    if (!interaction.channel || typeof interaction.channel.setTopic !== 'function') { await interaction.reply({ content: 'This command only works in a text channel.', flags: MessageFlags.Ephemeral }); return; }
    const topic = interaction.options.getString('text')?.trim() || null;
    await interaction.channel.setTopic(topic, 'Channel topic updated by ' + interaction.user.tag);
    await interaction.reply({ content: topic ? 'Channel topic updated.' : 'Channel topic cleared.', flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'randomcolor') {
    const hex = '#' + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0').toUpperCase();
    const color = Number.parseInt(hex.slice(1), 16);
    const description = '**' + hex + '**\nRGB: ' + ((color >> 16) & 255) + ', ' + ((color >> 8) & 255) + ', ' + (color & 255);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('🎨 Random color').setDescription(description).setFooter({ text: 'Use this hex code in your project or server design.' })], flags: MessageFlags.Ephemeral });
   }
   else if (interaction.commandName === 'remindme') {
    const minutes = interaction.options.getInteger('minutes', true);
    const reminder = interaction.options.getString('reminder', true).trim();
    await interaction.reply({ content: '⏰ I’ll DM you in ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + ': **' + reminder + '**\nKeep DMs open. Reminders are lost if the bot restarts before they fire.', flags: MessageFlags.Ephemeral });
    const timer = setTimeout(() => interaction.user.send('⏰ Reminder from Meta Code: ' + reminder).catch(() => {}), minutes * 60000);
    timer.unref?.();
   }
   else if (interaction.commandName === 'security-test') {
    const alertUserId = String(process.env.META_SECURITY_ALERT_USER_ID || '1393734299663994910').trim();
    if (interaction.user.id !== alertUserId) {
     await interaction.reply({ content: 'This command is restricted to the configured bot owner.', flags: MessageFlags.Ephemeral });
     return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
     const owner = await client.users.fetch(alertUserId);
     await owner.send({ embeds: [new EmbedBuilder().setColor(0x22C55E).setTitle('Meta Code security test').setDescription('✅ Test successful. Security alerts are reaching this Discord account.').setTimestamp()], allowedMentions: { parse: [] } });
     await interaction.editReply('✅ Test DM sent. Check your Discord messages.');
    } catch (error) {
     console.error('[Security] Test DM delivery failed:', error?.message || error);
     await interaction.editReply('❌ Could not send the test DM. Check that your DMs are open and the bot can message you.');
    }
   }
   else if (interaction.commandName === 'ping') await interaction.reply({ content: 'Meta bot is online ✅', flags: MessageFlags.Ephemeral });
   else if (interaction.commandName === 'lessons') await interaction.reply({ content: `Start learning: ${siteUrl}/play`, flags: MessageFlags.Ephemeral });
   else if (interaction.commandName === 'meta') await interaction.reply({ content: `Welcome to Meta CodeLearn!\nWebsite: ${siteUrl}\nLessons: ${siteUrl}/play\nProjects: ${siteUrl}/projects\nAccount: ${siteUrl}/account`, flags: MessageFlags.Ephemeral });
   return;
  }
    if (await handleStaffApplicationComponent(interaction)) return;
    if (await handleCommunityComponent(interaction)) return;
    if (
      interaction.isButton() &&
      ['setup_server_confirm', 'setup_server_cancel'].includes(interaction.customId)
    ) {
      await handleServerSetupButton(interaction);
      return;
    }
    if (
      (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
      (interaction.customId === 'ticket_create' ||
       interaction.customId === 'ticket_category_select' ||
       interaction.customId.startsWith('ticket_category_button_') ||
       interaction.customId.startsWith('ticket_form_submit_') ||
       interaction.customId.startsWith('ticket_close_'))
    ) {
      await handleTicketButton(interaction, db);
      return;
    }
 } catch (error) {
  console.error('Interaction failed:', error.message);
  if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong. Please try again later.', flags: MessageFlags.Ephemeral }).catch(() => {});
 }
});
handleCommunityEvents(client);
let processingWebsiteSetups = false;
async function processWebsiteSetups() {
 if (processingWebsiteSetups || !client.isReady()) return;
 processingWebsiteSetups = true;
 try {
  const pending = db.prepare("SELECT * FROM bot_setup_outbox WHERE status = 'pending' ORDER BY id LIMIT 2").all();
  for (const item of pending) {
   try {
    const homeGuildId = String(process.env.META_HOME_GUILD_ID || process.env.DISCORD_GUILD_ID || '').trim();
    if (!homeGuildId || item.guild_id !== homeGuildId) throw new Error('This job is not for the configured Meta home server.');
    const guild = await client.guilds.fetch(homeGuildId);
    const template = JSON.parse(item.template_json);
    let result;
    if (item.action === 'apply') {
      result = await applyServerTemplate(guild, template, {
        deleteUnlisted: true,
        expectedFingerprint: item.confirmation_hash
      });
      result.mode = 'applied';
    } else {
      result = await previewServerTemplate(guild, template);
      result.mode = 'preview';
    }
    db.prepare("UPDATE bot_setup_outbox SET status = 'applied', result_json = ?, error = NULL, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
      .run(JSON.stringify(result), item.id);
    console.log('Website setup job completed:', item.id, result.mode);
   } catch (error) {
    db.prepare("UPDATE bot_setup_outbox SET status = 'failed', error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
      .run(String(error?.message || 'Setup failed').slice(0, 1000), item.id);
    console.error('Website setup publish failed:', error?.message || error);
   }
  }
 } catch (error) { console.error('Website setup queue check failed:', error?.message || error); }
 finally { processingWebsiteSetups = false; }
}
setInterval(() => { void processWebsiteSetups(); }, 2000).unref();


// Discord anti-spam signal: count rapid message bursts without reading message text.
// Keeps only a short in-memory window and emits a security event for owner review.
const recentDiscordMessages = new Map();
const spamAlertCooldown = new Map();
const SPAM_WINDOW_MS = 10000;
const SPAM_THRESHOLD = 7;
client.on(Events.MessageCreate, message => {
 if (!message.guild || message.author?.bot || message.webhookId) return;
 const now = Date.now();
 const key = `${message.guild.id}:${message.author.id}`;
 const timestamps = (recentDiscordMessages.get(key) || []).filter(ts => now - ts < SPAM_WINDOW_MS);
 timestamps.push(now);
 recentDiscordMessages.set(key, timestamps);
 if (timestamps.length < SPAM_THRESHOLD) return;
 if (now - (spamAlertCooldown.get(key) || 0) < 60000) return;
 spamAlertCooldown.set(key, now);
 const subjectHash = createHash('sha256').update(message.author.id).digest('hex').slice(0, 24);
 const detail = `guild=${message.guild.id}; channel=${message.channel.id}; burst=${timestamps.length} messages/${SPAM_WINDOW_MS/1000}s`;
 db.prepare('INSERT INTO security_events (source,event_type,subject_hash,detail) VALUES (?,?,?,?)')
   .run('discord', 'rapid_message_burst', subjectHash, detail);
 console.warn('[Security] Rapid Discord message burst detected:', detail);
});
setInterval(() => {
 const cutoff = Date.now() - SPAM_WINDOW_MS;
 for (const [key, values] of recentDiscordMessages) {
  const fresh = values.filter(ts => ts > cutoff);
  if (fresh.length) recentDiscordMessages.set(key, fresh); else recentDiscordMessages.delete(key);
 }
}, SPAM_WINDOW_MS).unref();

async function processSecurityAlerts() {
 // Send security notifications privately to the configured owner account.
 const alertUserId = String(process.env.META_SECURITY_ALERT_USER_ID || '1393734299663994910').trim();
 if (!/^\d{17,20}$/.test(alertUserId) || !client.isReady()) return;
 const pending = db.prepare("SELECT * FROM security_events WHERE status='pending' ORDER BY id LIMIT 5").all();
 for (const event of pending) {
  try {
   const owner = await client.users.fetch(alertUserId);
   if (!owner) throw new Error('Configured security alert user is unavailable.');
   const embed = new EmbedBuilder().setColor(0xF59E0B).setTitle('Meta Code security signal')
    .setDescription(`**Source:** ${event.source}\n**Event:** ${event.event_type}\n**Details:** ${String(event.detail || '').slice(0, 800)}\n**Event ID:** ${event.id}`)
    .setTimestamp(new Date(event.created_at + 'Z'));
   await owner.send({ embeds: [embed], allowedMentions: { parse: [] } });
   db.prepare("UPDATE security_events SET status='alerted' WHERE id=? AND status='pending'").run(event.id);
  } catch (error) {
   console.error('[Security] Could not deliver alert:', error?.message || error);
   break;
  }
 }
}
setInterval(() => { void processSecurityAlerts(); }, 5000).unref();

let processingWebsiteMessages = false;
async function processWebsiteMessages() {
 if (processingWebsiteMessages || !client.isReady()) return;
 processingWebsiteMessages = true;
 try {
  const pending = db.prepare("SELECT * FROM bot_message_outbox WHERE status = 'pending' ORDER BY id LIMIT 5").all();
  for (const item of pending) {
   try {
    const homeGuildId = String(process.env.META_HOME_GUILD_ID || process.env.DISCORD_GUILD_ID || '').trim();
    if (!homeGuildId || item.guild_id !== homeGuildId) throw new Error('Destination is not the configured Meta home server.');
    const channel = await client.channels.fetch(item.channel_id);
    if (!channel || channel.guildId !== homeGuildId || !channel.isTextBased() || typeof channel.send !== 'function') throw new Error('Destination is not an accessible text channel in the Meta home server.');
    let messagePayload;
    try {
      const queued = JSON.parse(item.content);
      if (queued && queued.__meta_code_embed === true) {
        const embed = new EmbedBuilder()
          .setDescription(queued.description)
          .setColor(queued.color || '#5865F2');
        if (queued.title) embed.setTitle(queued.title);
        messagePayload = { embeds: [embed], allowedMentions: { parse: [] } };
      }
    } catch { /* Normal plain-text message */ }
    if (!messagePayload) messagePayload = { content: item.content, allowedMentions: { parse: [] } };
    await channel.send(messagePayload);
    db.prepare("UPDATE bot_message_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error = NULL WHERE id = ? AND status = 'pending'").run(item.id);
   } catch (error) {
    db.prepare("UPDATE bot_message_outbox SET status = 'failed', error = ? WHERE id = ? AND status = 'pending'").run(String(error?.message || 'Send failed').slice(0, 500), item.id);
    console.error('Website message send failed:', error?.message || error);
   }
  }
 } catch (error) { console.error('Website message queue check failed:', error?.message || error); }
 finally { processingWebsiteMessages = false; }
}
setInterval(() => { void processWebsiteMessages(); }, 2000).unref();
client.login(token);

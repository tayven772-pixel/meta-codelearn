import 'dotenv/config';
import { ticketCommand } from './lib/ticket-commands.js';
import { serverSetupCommand } from './lib/server-setup.js';
import { handleTicketCommand, handleTicketButton } from './lib/tickets.js';
import { handleServerSetup, handleServerSetupButton } from './lib/server-setup.js';
import { db } from './lib/database.js';
import { moderationCommands, handleModerationCommand } from './lib/moderation.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, GatewayIntentBits, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
const siteUrl = (process.env.META_SITE_URL || 'https://metasupportcom.dbm.shared-servers.com').replace(/\/$/, '');
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token || !clientId) { console.error('Missing bot token or client ID in .env'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = [
 new SlashCommandBuilder().setName('meta').setDescription('Open Meta CodeLearn and explore coding lessons'),
 new SlashCommandBuilder().setName('lessons').setDescription('Get Meta CodeLearn learning links'),
 new SlashCommandBuilder().setName('ping').setDescription('Check whether the Meta bot is online'),
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
 new SlashCommandBuilder().setName('setup-applications').setDescription('Post the staff application panel in this channel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 ticketCommand,
 serverSetupCommand,
 ...moderationCommands.map(command => ({ toJSON: () => command })),
].map(command => command.toJSON());
client.once(Events.ClientReady, async readyClient => {
 console.log(`Meta bot ready as ${readyClient.user.tag}`);
 try { if (guildId) await readyClient.application.commands.set(commands, guildId); else await readyClient.application.commands.set(commands); console.log('Registered Meta CodeLearn slash commands.'); }
 catch (error) { console.error('Command registration failed:', error.message); }
});
client.on(Events.InteractionCreate, async interaction => {
 try {
  if (interaction.isChatInputCommand()) {
   if (await handleModerationCommand(interaction)) return;
   if (interaction.commandName === 'setup-server') {
    await handleServerSetup(interaction);
    return;
   }
     if (interaction.commandName === 'ticket') {
      await handleTicketCommand(interaction, db);
      return;
     }
   if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
     .setColor(0x42B883)
     .setTitle('Meta Bot | Command Guide')
     .setDescription('Helpful tools for the Meta Code community.')
     .addFields(
      { name: 'Learning', value: '`/meta` — website, projects and account links\n`/lessons` — jump into coding lessons', inline: false },
      { name: 'Community', value: '`/poll` — create a reaction poll\n`/suggest` — share an idea\n`/coinflip` — flip a coin\n`/roll` — random number\n`/choose` — choose from a list\n`/8ball` — playful answer\n`/serverinfo` — server details\n`/userinfo` — member details\n`/ping` — check bot status', inline: false },
      { name: 'Administrator', value: '`/announce` — post an official announcement (administrators only)', inline: false },
      { name: 'Staff tools', value: '`/ticket`, `/ticket-panel`, `/setup-server`, `/setup-applications` — availability depends on your server permissions and bot setup.', inline: false }
     )
     .setFooter({ text: 'Meta Code • Learn the idea, then the code' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
   else if (interaction.commandName === 'ping') await interaction.reply({ content: 'Meta bot is online ✅', flags: MessageFlags.Ephemeral });
   else if (interaction.commandName === 'lessons') await interaction.reply({ content: `Start learning: ${siteUrl}/play`, flags: MessageFlags.Ephemeral });
   else if (interaction.commandName === 'meta') await interaction.reply({ content: `Welcome to Meta CodeLearn!\nWebsite: ${siteUrl}\nLessons: ${siteUrl}/play\nProjects: ${siteUrl}/projects\nAccount: ${siteUrl}/account`, flags: MessageFlags.Ephemeral });
   else if (interaction.commandName === 'setup-applications') {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: 'Only server administrators can post this panel.', flags: MessageFlags.Ephemeral }); return; }
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('Meta CodeLearn | Staff Applications').setDescription('Want to help Meta CodeLearn grow? We are looking for friendly, responsible people to support our community.\n\n**Available areas**\n• Community Moderator\n• Support Team\n• Coding Helper\n\n**How it works**\nClick **Apply for Staff** to begin privately through Discord DMs. Keep your DMs open so the bot can contact you.').setFooter({ text: 'Meta CodeLearn • Staff Recruitment' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('staff_apply_start').setLabel('Apply for Staff').setEmoji('📋').setStyle(ButtonStyle.Primary));
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Staff application panel posted.', flags: MessageFlags.Ephemeral });
   }
   return;
  }
    if (
      interaction.isButton() &&
      ['setup_server_confirm', 'setup_server_cancel'].includes(interaction.customId)
    ) {
      await handleServerSetupButton(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId === 'ticket_create') {
     await handleTicketButton(interaction, db);
     return;
    }
  if (interaction.isButton() && interaction.customId === 'staff_apply_start') {
   try { await interaction.user.send('Welcome to Meta CodeLearn staff recruitment! 📋\n\nYou started the staff application process. The private questionnaire and submission workflow are the next setup step. Please keep your DMs open.'); await interaction.reply({ content: 'I sent you a DM. Check your Discord messages.', flags: MessageFlags.Ephemeral }); }
   catch { await interaction.reply({ content: 'I could not DM you. Please enable DMs from server members and try again.', flags: MessageFlags.Ephemeral }); }
  }
 } catch (error) {
  console.error('Interaction failed:', error.message);
  if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong. Please try again later.', flags: MessageFlags.Ephemeral }).catch(() => {});
 }
});
client.login(token);

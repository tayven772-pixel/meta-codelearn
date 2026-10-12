import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags, SlashCommandBuilder } from 'discord.js';

const siteUrl = (process.env.META_SITE_URL || 'https://metasupport.com').replace(/\/$/, '');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, readyClient => {
  console.log(`Meta bot ready as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: 'Meta bot is online ✅', flags: MessageFlags.Ephemeral });
    } else if (interaction.commandName === 'lessons') {
      await interaction.reply({ content: `Start learning with Meta CodeLearn: ${siteUrl}/play\nExplore lessons and coding projects.`, flags: MessageFlags.Ephemeral });
    } else if (interaction.commandName === 'meta') {
      await interaction.reply({ content: `Welcome to Meta CodeLearn!\nWebsite: ${siteUrl}\nLessons: ${siteUrl}/play\nProjects: ${siteUrl}/projects\nAccount: ${siteUrl}/account\n\nSign in on the website with Discord to connect your profile.`, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error('Command failed:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Sorry, that command did not work. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
  console.error('Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID in discord-bot/.env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName('meta').setDescription('Open Meta CodeLearn and explore coding lessons'),
  new SlashCommandBuilder().setName('lessons').setDescription('Get the Meta CodeLearn learning links'),
  new SlashCommandBuilder().setName('ping').setDescription('Check whether the Meta bot is online'),
].map(command => command.toJSON());

client.once(Events.ClientReady, async readyClient => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId) await readyClient.application.commands.set(commands, guildId);
    else await readyClient.application.commands.set(commands);
    console.log('Registered Meta bot slash commands.');
  } catch (error) {
    console.error('Could not register slash commands:', error);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);

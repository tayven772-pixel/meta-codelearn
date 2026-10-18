import 'dotenv/config';
import { ticketCommand } from './lib/ticket-commands.js';
import { serverSetupCommand } from './lib/server-setup.js';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const legacyGuildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('meta')
    .setDescription('Open Meta CodeLearn and explore coding lessons'),
  new SlashCommandBuilder()
    .setName('lessons')
    .setDescription('Get Meta CodeLearn learning links'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check whether the Meta bot is online'),
  new SlashCommandBuilder()
    .setName('setup-applications')
    .setDescription('Post the staff application panel in this channel'),
  ticketCommand,
  serverSetupCommand,
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

try {
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands }
  );
  // Clean up the old guild-only command copies left by previous versions.
  if (legacyGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(clientId, legacyGuildId),
      { body: [] }
    ).catch(error => console.warn('Could not clear legacy server-only commands:', error.message));
  }
  console.log(`Registered ${commands.length} global slash commands for every server the bot joins.`);
} catch (error) {
  console.error('Command registration failed:', error.message);
  process.exitCode = 1;
}

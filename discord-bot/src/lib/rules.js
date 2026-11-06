import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getSetting, setSetting } from './database.js';

const SETTINGS_KEY = 'community_rules_config';
const LAST_CHANNEL_KEY = 'community_rules_message_channel';
const LAST_MESSAGE_KEY = 'community_rules_message_id';

const DEFAULT_CONFIG = {
  title: '🏛️ Meta Code Community Guidelines',
  description: 'Welcome to **Meta Code** — *Learn the idea, then the code.* 💙\n\nBy participating in this community and using our platform, you agree to maintain the professional, respectful, and intellectual standards expected of our development community.',
  color: '#42B883',
  footer: 'Meta Code Administration • Learn the idea, then the code',
  rules: [
    '🤝 Professional Conduct|Treat every developer and student with dignity. Harassment, discrimination, bullying, and personal attacks are prohibited.',
    '💬 Constructive Dialogue|Keep code reviews and project debates civil. Criticism should focus on the work, never the person. Resolve personal conflicts privately or through a moderation ticket.',
    '🧭 Channel Etiquette|Post questions, code snippets, and project updates in their designated channels. Follow channel-specific instructions.',
    '✅ Appropriate Content|All media, repositories, links, and discussions must remain Safe For Work (SFW) and suitable for an educational environment.',
    '🧩 Protect Learning Experiences|Do not reveal unmasked answers to interactive coding games or assignments. Use Discord spoiler formatting (||spoiler text||) when sharing solutions.',
    '🚫 No Disruption|Script spam, excessive capitalization, message flooding, unnecessary staff mentions, and mass pings are prohibited.',
    '🌐 Primary Language|Use English in public technical discussions so the moderation team can accurately review and support conversations.',
    '🔒 Security & Privacy|Malware, phishing, credential theft, malicious downloads, unauthorized access, and attacks on services are prohibited. Never publish passwords, API keys, private credentials, or personal information without permission.',
    '📣 No Unsolicited Solicitation|Do not use direct messages to recruit members to unrelated servers, solicit freelance services, or promote unauthorized commercial projects.',
    '©️ Intellectual Property|Do not claim another person’s code, projects, or resources as your own. Credit original creators and follow applicable licenses.',
    '🤖 AI Transparency|AI-generated code and content are welcome when permitted, but do not misrepresent another person’s work or submit copied work as your own.',
    '⚖️ Obligatory Terms|[Meta Code Privacy Policy](https://metacodework.dbm.shared-servers.com/privacy)\n[Discord Terms of Service](https://discord.com/terms)\n[Discord Community Guidelines](https://discord.com/guidelines)',
    '⚖️ Accountability Framework|Stage I: Formal notice. Stage II: 24-hour timeout. Stage III: 7-day timeout. Stage IV: Permanent ban. Moderators may skip stages depending on severity, intent, and circumstances. Previous violations may be considered.',
    '📩 Appeals & Support|Members who believe a moderation action was applied incorrectly may submit an appeal through the official support or moderation ticket system. Appeals must remain respectful.',
    '⚙️ Automated Infrastructure|Membership Screening, AutoMod, Community Onboarding, and moderation logging may be used to support enforcement. These tools supplement human moderation and do not replace members’ responsibility to follow these guidelines.'
  ].join('\n')
};

export const rulesCommands = [
  new SlashCommandBuilder()
    .setName('editrules')
    .setDescription('Edit the server rules embed (administrator only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

function readConfig(guildId) {
  try {
    const saved = getSetting(guildId, SETTINGS_KEY);
    if (!saved) return DEFAULT_CONFIG;
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function parseRules(text) {
  const lines = String(text || '').split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 20) {
    throw new Error('Add between 1 and 20 rules, one per line.');
  }
  return lines.map((line, index) => {
    const separator = line.indexOf('|');
    if (separator < 1) throw new Error(`Rule line ${index + 1} must use: Heading | Rule details`);
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!name || name.length > 256 || !value || value.length > 1024) {
      throw new Error(`Rule line ${index + 1} has an empty heading/details or exceeds Discord's limits.`);
    }
    return { name, value, inline: false };
  });
}

export function buildRulesEmbed(config) {
  const fields = parseRules(config.rules);
  const color = Number.parseInt(String(config.color).replace(/^#/, ''), 16);
  if (!Number.isInteger(color) || !/^(?:[0-9a-fA-F]{6})$/.test(String(config.color).replace(/^#/, ''))) {
    throw new Error('The saved rules color is invalid. Run /editrules and use a six-digit hex color.');
  }
  const description = String(config.description || '').trim();
  if (description.length > 4096) throw new Error('Rules description exceeds Discord’s 4,096-character limit.');
  const total = description.length + fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0);
  if (total > 5800) throw new Error('The rules are too long for one Discord embed. Shorten the description or rule text.');
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(String(config.title || '').slice(0, 256))
    .setDescription(description || null)
    .addFields(fields)
    .setFooter({ text: String(config.footer || 'Meta Code Administration').slice(0, 2048) })
    .setTimestamp();
}

function makeInput(id, label, style, value, maxLength, required = true) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setMaxLength(maxLength)
    .setRequired(required);
  if (value) input.setValue(String(value).slice(0, maxLength));
  return new ActionRowBuilder().addComponents(input);
}

async function openEditor(interaction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Only server administrators can edit the rules.', ephemeral: true });
    return;
  }
  const config = readConfig(interaction.guildId);
  const modal = new ModalBuilder()
    .setCustomId('meta_rules_editor')
    .setTitle('Edit Meta Code Rules')
    .addComponents(
      makeInput('rules_title', 'Embed title', TextInputStyle.Short, config.title, 256),
      makeInput('rules_description', 'Introduction / description', TextInputStyle.Paragraph, config.description, 1000, false),
      makeInput('rules_entries', 'Rules: one per line, Heading | Details', TextInputStyle.Paragraph, config.rules, 4000),
      makeInput('rules_color', 'Embed color (hex, e.g. #42B883)', TextInputStyle.Short, config.color, 7),
      makeInput('rules_footer', 'Embed footer', TextInputStyle.Short, config.footer, 200, false)
    );
  await interaction.showModal(modal);
}

async function saveEditor(interaction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Only server administrators can edit the rules.', ephemeral: true });
    return;
  }
  const config = {
    title: interaction.fields.getTextInputValue('rules_title').trim(),
    description: interaction.fields.getTextInputValue('rules_description').trim(),
    rules: interaction.fields.getTextInputValue('rules_entries').trim(),
    color: interaction.fields.getTextInputValue('rules_color').trim(),
    footer: interaction.fields.getTextInputValue('rules_footer').trim() || DEFAULT_CONFIG.footer
  };
  if (!config.title || config.title.length > 256) {
    await interaction.reply({ content: 'The title must contain 1–256 characters.', ephemeral: true });
    return;
  }
  try {
    const preview = buildRulesEmbed(config);
    setSetting(interaction.guildId, SETTINGS_KEY, JSON.stringify(config));

    const channelId = getSetting(interaction.guildId, LAST_CHANNEL_KEY);
    const messageId = getSetting(interaction.guildId, LAST_MESSAGE_KEY);
    let updatedExisting = false;
    if (channelId && messageId) {
      try {
        const channel = await interaction.guild.channels.fetch(channelId);
        if (channel?.isTextBased() && typeof channel.messages?.fetch === 'function') {
          const message = await channel.messages.fetch(messageId);
          await message.edit({ embeds: [preview], allowedMentions: { parse: [] } });
          updatedExisting = true;
        }
      } catch (error) {
        console.warn('[Rules] Saved rules but could not update the previous post:', error?.message || error);
      }
    }
    await interaction.reply({
      content: updatedExisting
        ? '✅ Rules saved. I also updated the previous rules message.'
        : '✅ Rules saved. Run /rules to post the updated version in a channel.',
      ephemeral: true
    });
  } catch (error) {
    await interaction.reply({ content: `Could not save the rules: ${error.message}`, ephemeral: true });
  }
}

export async function handleRulesInteraction(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'editrules') {
    await openEditor(interaction);
    return true;
  }
  if (interaction.isModalSubmit() && interaction.customId === 'meta_rules_editor') {
    await saveEditor(interaction);
    return true;
  }
  return false;
}

export function rememberRulesMessage(guildId, channelId, messageId) {
  setSetting(guildId, LAST_CHANNEL_KEY, channelId);
  setSetting(guildId, LAST_MESSAGE_KEY, messageId);
}

export function getRulesEmbed(guildId) {
  return buildRulesEmbed(readConfig(guildId));
}

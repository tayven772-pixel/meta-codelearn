import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { getSetting } from './database.js';

export const serverSetupCommand = new SlashCommandBuilder()
  .setName('setup-server')
  .setDescription('Reset server channels and rebuild the Meta Code template (asks for confirmation)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const roleDefinitions = [
  { name: 'Founder', color: 0xF4C95D },
  { name: 'Administrator', color: 0x8D9DFF },
  { name: 'Moderator', color: 0x70C7A1 },
  { name: 'Support Team', color: 0x8AD7E8 },
  { name: 'Mentor', color: 0xB8A1F4 },
  { name: 'Developer', color: 0xB3D9A1 },
  { name: 'Community Member', color: 0xD7DCE4 }
];

const layout = [
  {
    name: '📍 GET STARTED',
    channels: [
      ['text', 'welcome'],
      ['text', 'rules'],
      ['text', 'announcements'],
      ['text', 'official-links'],
      ['text', 'choose-roles']
    ]
  },
  {
    name: '💬 COMMUNITY',
    channels: [
      ['text', 'general-chat'],
      ['text', 'introductions'],
      ['text', 'questions'],
      ['text', 'ideas-and-feedback'],
      ['text', 'project-showcase']
    ]
  },
  {
    name: '💻 LEARN AND BUILD',
    channels: [
      ['text', 'learning-resources'],
      ['text', 'web-development'],
      ['text', 'discord-bots'],
      ['text', 'coding-challenges'],
      ['text', 'github-and-projects']
    ]
  },
  {
    name: '🛟 META SUPPORT',
    channels: [
      ['text', 'open-a-ticket'],
      ['text', 'bug-reports'],
      ['text', 'suggestions']
    ]
  },
  {
    name: '🔊 VOICE LOUNGE',
    channels: [
      ['voice', 'Community Lounge'],
      ['voice', 'Coding Together'],
      ['voice', 'AFK']
    ]
  },
  {
    name: '🔐 STAFF HQ',
    private: true,
    channels: [
      ['text', 'staff-chat'],
      ['text', 'staff-applications'],
      ['text', 'ticket-logs'],
      ['text', 'moderation-logs']
    ]
  }
];

export async function applyServerTemplate(guild, template) {
  if (!template || !Array.isArray(template.roles) || !Array.isArray(template.categories)) {
    throw new Error('Template must contain roles and categories arrays.');
  }
  if (template.roles.length > 40 || template.categories.length > 30 ||
      template.roles.some(role => !role || typeof role.name !== 'string' || !role.name.trim() || role.name.length > 100 ||
        (role.color !== undefined && (!Number.isInteger(role.color) || role.color < 0 || role.color > 0xFFFFFF))) ||
      template.categories.some(group => !group || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 100 ||
        !Array.isArray(group.channels) || group.channels.length > 50 ||
        group.channels.some(channel => !Array.isArray(channel) || !['text','voice'].includes(channel[0]) ||
          typeof channel[1] !== 'string' || !channel[1].trim() || channel[1].length > 100))) {
    throw new Error('Invalid template structure or values.');
  }
  await guild.roles.fetch();
  await guild.channels.fetch();
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Meta needs Manage Channels and Manage Roles permissions.');
  }
  const created = [], updated = [], skipped = [], errors = [];
  for (const definition of template.roles) {
    try {
      let role = guild.roles.cache.find(item => item.name === definition.name.trim());
      if (!role) {
        role = await guild.roles.create({ name: definition.name.trim(), color: definition.color ?? 0xD7DCE4, reason: 'Published Meta Code setup template' });
        created.push('role ' + role.name);
      } else {
        const color = definition.color ?? role.color;
        if (role.color !== color) { await role.edit({ color, reason: 'Published Meta Code setup template' }); updated.push('role ' + role.name); }
        else skipped.push('role ' + role.name);
      }
    } catch (error) { errors.push('Role ' + definition.name + ': ' + error.message); }
  }
  for (const group of template.categories) {
    try {
      let category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name === group.name.trim());
      const overwrites = group.private ? [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...['Founder','Administrator','Moderator','Support Team'].map(name => guild.roles.cache.find(role => role.name === name)).filter(Boolean)
          .map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
      ] : [];
      if (!category) {
        category = await guild.channels.create({ name: group.name.trim(), type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: 'Published Meta Code setup template' });
        created.push('category ' + category.name);
      } else if (group.private) {
        await category.edit({ permissionOverwrites: overwrites, reason: 'Published Meta Code setup template' });
        updated.push('category ' + category.name);
      } else {
        skipped.push('category ' + category.name);
      }
      for (const [kind, rawName] of group.channels) {
        const name = rawName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'new-channel';
        const type = kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
        const existing = guild.channels.cache.find(item => item.name === name && item.type === type && item.parentId === category.id);
        if (existing) { skipped.push('channel ' + name); continue; }
        await guild.channels.create({ name, type, parent: category.id, reason: 'Published Meta Code setup template' });
        created.push('channel ' + name);
      }
    } catch (error) { errors.push('Category ' + group.name + ': ' + error.message); }
  }
  return { created, updated, skipped, errors };
}

export async function handleServerSetup(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'Run this command inside your Discord server.', ephemeral: true });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply('I need Manage Channels and Manage Roles permissions before applying a setup.');
  }
  let template = null;
  const saved = getSetting(guild.id, 'server_setup_template');
  if (saved) { try { template = JSON.parse(saved); } catch { /* use built-in fallback */ } }
  if (!template) template = { roles: roleDefinitions, categories: layout };
  try {
    const result = await applyServerTemplate(guild, template);
    return interaction.editReply('✅ **Meta Code setup applied safely.**\nCreated: ' + result.created.length + '\nUpdated: ' + result.updated.length + '\nAlready matched: ' + result.skipped.length + '\nIssues: ' + result.errors.length + (result.errors.length ? '\n' + result.errors.slice(0, 8).join('\n') : '') + '\nExisting channels and messages were preserved.');
  } catch (error) { return interaction.editReply('Setup failed: ' + error.message); }
}



export async function handleServerSetupButton(interaction) {
  return interaction.reply({ content: 'This setup confirmation is no longer used. Publish a template from the owner dashboard or run /setup-server.', ephemeral: true });
}

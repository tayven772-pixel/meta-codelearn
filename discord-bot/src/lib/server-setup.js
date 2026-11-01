import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { createHash } from 'node:crypto';
import { getSetting, setSetting } from './database.js';

export const serverSetupCommand = new SlashCommandBuilder()
  .setName('setup-server')
  .setDescription('Apply the saved Meta Code server setup template safely')
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

export function normalizeChannelName(rawName) {
  return String(rawName).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'new-channel';
}

export function validateServerTemplate(template) {
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
  const roleNames = template.roles.map(role => role.name.trim().toLowerCase());
  if (new Set(roleNames).size !== roleNames.length) throw new Error('Role names must be unique.');
  const categoryNames = template.categories.map(group => group.name.trim().toLowerCase());
  if (new Set(categoryNames).size !== categoryNames.length) throw new Error('Category names must be unique.');
  const channelKeys = [];
  for (const group of template.categories) for (const [kind, rawName] of group.channels) {
    channelKeys.push(kind + ':' + normalizeChannelName(rawName));
  }
  if (new Set(channelKeys).size !== channelKeys.length) throw new Error('Channel names must be unique for each channel type after normalization.');
  const panel = template.controlPanel;
  if (panel !== undefined && (!panel || typeof panel !== 'object' || Array.isArray(panel) ||
      (panel.title !== undefined && (typeof panel.title !== 'string' || panel.title.length > 80)) ||
      (panel.description !== undefined && (typeof panel.description !== 'string' || panel.description.length > 240)) ||
      (panel.sections !== undefined && (!Array.isArray(panel.sections) ||
        panel.sections.some(section => !['setup','commands','responses','tickets','messages','community','autopartner','applications'].includes(section))))) {
    throw new Error('controlPanel must use a title, description, and known sections only.');
  }
  const settings = template.settings;
  if (settings !== undefined && (!settings || typeof settings !== 'object' || Array.isArray(settings))) {
    throw new Error('settings must be a JSON object.');
  }
  for (const [key, block] of Object.entries(settings || {})) {
    if (!['welcome','autopartner','applications','tickets'].includes(key) || !block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error('Unsupported settings block: ' + key);
    }
  }
  const welcome = settings?.welcome;
  if (welcome && ((welcome.enabled !== undefined && typeof welcome.enabled !== 'boolean') ||
      (welcome.showAvatar !== undefined && typeof welcome.showAvatar !== 'boolean') ||
      (welcome.message !== undefined && (typeof welcome.message !== 'string' || welcome.message.length > 1500)))) {
    throw new Error('settings.welcome supports enabled/showAvatar booleans and a message up to 1500 characters.');
  }
  const partner = settings?.autopartner;
  if (partner && ((partner.enabled !== undefined && typeof partner.enabled !== 'boolean') ||
      (partner.intervalHours !== undefined && (!Number.isInteger(partner.intervalHours) || partner.intervalHours < 6 || partner.intervalHours > 168)) ||
      (partner.minimumMembers !== undefined && (!Number.isInteger(partner.minimumMembers) || partner.minimumMembers < 10 || partner.minimumMembers > 1000000)))) {
    throw new Error('settings.autopartner has invalid enabled, intervalHours, or minimumMembers values.');
  }
  const applications = settings?.applications;
  if (applications && ((applications.enabled !== undefined && typeof applications.enabled !== 'boolean') ||
      (applications.panelTitle !== undefined && (typeof applications.panelTitle !== 'string' || applications.panelTitle.length > 45)) ||
      (applications.panelDescription !== undefined && (typeof applications.panelDescription !== 'string' || applications.panelDescription.length > 1000)))) {
    throw new Error('settings.applications has invalid enabled, panelTitle, or panelDescription values.');
  }
  const tickets = settings?.tickets;
  if (tickets && ((tickets.panelTitle !== undefined && (typeof tickets.panelTitle !== 'string' || tickets.panelTitle.length > 256)) ||
      (tickets.panelDescription !== undefined && (typeof tickets.panelDescription !== 'string' || tickets.panelDescription.length > 4000)))) {
    throw new Error('settings.tickets panel text exceeds Discord limits.');
  }
  const channelDefinitions = new Map();
  for (const group of template.categories) for (const [kind, name] of group.channels) {
    channelDefinitions.set(normalizeChannelName(name), kind);
  }
  const categoryNamesForSettings = new Set(template.categories.map(group => normalizeChannelName(group.name)));
  for (const [blockName, channelKey] of [['welcome','channel'],['autopartner','channel'],['applications','staffChannel']]) {
    const value = settings?.[blockName]?.[channelKey];
    if (value && channelDefinitions.get(normalizeChannelName(value)) !== 'text') {
      throw new Error('settings.' + blockName + '.' + channelKey + ' must reference a text channel in categories.');
    }
  }
  const ticketCategory = settings?.tickets?.category;
  if (ticketCategory && !categoryNamesForSettings.has(normalizeChannelName(ticketCategory))) {
    throw new Error('settings.tickets.category must reference a category name in categories.');
  }
}

function desiredChannelDefinitions(template) {
  const output = [];
  for (const group of template.categories) {
    for (const [kind, rawName] of group.channels) {
      output.push({
        name: normalizeChannelName(rawName),
        type: kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        categoryName: group.name.trim()
      });
    }
  }
  return output;
}

export async function buildServerTemplatePlan(guild, template, deleteUnlisted = true) {
  validateServerTemplate(template);
  await guild.roles.fetch();
  await guild.channels.fetch();
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Meta needs Manage Channels and Manage Roles permissions.');
  }

  const desiredRoles = new Set(template.roles.map(role => role.name.trim().toLowerCase()));
  const desiredCategories = new Set(template.categories.map(group => group.name.trim().toLowerCase()));
  const desiredChannels = desiredChannelDefinitions(template);
  const usedRoleIds = new Set();
  const usedCategoryIds = new Set();
  const usedChannelIds = new Set();
  const createRoles = [], updateRoles = [], deleteRoles = [], protectedRoles = [];
  const createCategories = [], updateCategories = [], deleteCategories = [];
  const createChannels = [], moveChannels = [], syncChannelPermissions = [], deleteChannels = [], protectedChannels = [];

  for (const definition of template.roles) {
    const existing = guild.roles.cache.find(role => role.name.toLowerCase() === definition.name.trim().toLowerCase());
    if (!existing) createRoles.push({ name: definition.name.trim(), color: definition.color ?? 0xD7DCE4 });
    else {
      usedRoleIds.add(existing.id);
      if (definition.color !== undefined && existing.color !== definition.color) updateRoles.push({ id: existing.id, name: existing.name, color: definition.color });
    }
  }

  const botHighest = botMember.roles.highest.position;
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id || usedRoleIds.has(role.id)) continue;
    const protectedRole = role.managed || role.permissions.has(PermissionFlagsBits.Administrator) ||
      role.position >= botHighest || botMember.roles.cache.has(role.id);
    if (protectedRole) protectedRoles.push({ id: role.id, name: role.name, reason: role.managed ? 'managed by Discord/integration' : role.permissions.has(PermissionFlagsBits.Administrator) ? 'administrator permission' : 'above or equal to Meta bot role' });
    else if (deleteUnlisted) deleteRoles.push({ id: role.id, name: role.name });
  }

  for (const group of template.categories) {
    const existing = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === group.name.trim().toLowerCase() && !usedCategoryIds.has(channel.id));
    if (!existing) createCategories.push({ name: group.name.trim(), private: Boolean(group.private) });
    else {
      usedCategoryIds.add(existing.id);
      updateCategories.push({ id: existing.id, name: existing.name, private: Boolean(group.private) });
    }
  }

  for (const definition of desiredChannels) {
    const category = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === definition.categoryName.toLowerCase());
    const existing = guild.channels.cache.find(channel => channel.type === definition.type && channel.name.toLowerCase() === definition.name && !usedChannelIds.has(channel.id));
    if (existing) {
      usedChannelIds.add(existing.id);
      if (!category || existing.parentId !== category.id) moveChannels.push({ id: existing.id, name: existing.name, fromCategory: existing.parent?.name || 'No category', toCategory: definition.categoryName });
      else syncChannelPermissions.push({ id: existing.id, name: existing.name, categoryName: definition.categoryName });
    } else {
      createChannels.push({ name: definition.name, type: definition.type, categoryName: definition.categoryName });
    }
  }

  const essentialChannelIds = new Set([
    guild.systemChannelId, guild.rulesChannelId, guild.publicUpdatesChannelId,
    guild.safetyAlertsChannelId
  ].filter(Boolean));
  for (const channel of guild.channels.cache.values()) {
    if (channel.type === ChannelType.GuildCategory || usedChannelIds.has(channel.id)) continue;
    if (essentialChannelIds.has(channel.id) || !channel.deletable) {
      protectedChannels.push({ id: channel.id, name: channel.name, reason: essentialChannelIds.has(channel.id) ? 'configured Discord system channel' : 'not deletable by Meta bot' });
    } else if (deleteUnlisted) {
      deleteChannels.push({ id: channel.id, name: channel.name, type: channel.type, parentId: channel.parentId });
    }
  }

  const protectedChannelIds = new Set(protectedChannels.map(item => item.id));
  for (const category of guild.channels.cache.values()) {
    if (category.type !== ChannelType.GuildCategory || usedCategoryIds.has(category.id)) continue;
    const hasProtectedChild = guild.channels.cache.some(channel => channel.parentId === category.id && protectedChannelIds.has(channel.id));
    if (!category.deletable || hasProtectedChild) {
      protectedChannels.push({ id: category.id, name: category.name, reason: hasProtectedChild ? 'contains a protected channel' : 'category not deletable by Meta bot' });
    } else if (deleteUnlisted) deleteCategories.push({ id: category.id, name: category.name });
  }

  const plan = { createRoles, updateRoles, deleteRoles, protectedRoles, createCategories, updateCategories, deleteCategories, createChannels, moveChannels, syncChannelPermissions, deleteChannels, protectedChannels };
  const fingerprint = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return { fingerprint, plan };
}

async function applyTemplateSettings(guild, template) {
  setSetting('global', 'server_setup_template', JSON.stringify(template));
  const settings = template.settings || {};
  const findChannel = name => guild.channels.cache.find(channel => channel.name === normalizeChannelName(name));
  const welcome = settings.welcome;
  if (welcome) {
    const channel = welcome.channel ? findChannel(welcome.channel) : null;
    if (welcome.enabled === false) setSetting('global', 'community_welcome_channel_id', '');
    else if (channel) setSetting('global', 'community_welcome_channel_id', channel.id);
    if (typeof welcome.message === 'string') setSetting('global', 'community_welcome_message', welcome.message.slice(0, 1500));
    setSetting('global', 'community_welcome_avatar', welcome.showAvatar === false ? 'false' : 'true');
  }
  const partner = settings.autopartner;
  if (partner) {
    const channel = partner.channel ? findChannel(partner.channel) : null;
    if (channel) setSetting('global', 'autopartner_channel_id', channel.id);
    if (typeof partner.enabled === 'boolean') setSetting('global', 'autopartner_enabled', partner.enabled ? 'true' : 'false');
    if (Number.isInteger(partner.intervalHours) && partner.intervalHours >= 6 && partner.intervalHours <= 168) setSetting('global', 'autopartner_interval_hours', String(partner.intervalHours));
    if (Number.isInteger(partner.minimumMembers) && partner.minimumMembers >= 1 && partner.minimumMembers <= 10000000) setSetting('global', 'autopartner_min_members', String(partner.minimumMembers));
  }
  const applications = settings.applications;
  if (applications) {
    const channel = applications.staffChannel ? findChannel(applications.staffChannel) : null;
    if (channel) setSetting('global', 'staff_applications_channel_id', channel.id);
    if (typeof applications.enabled === 'boolean') setSetting('global', 'staff_applications_enabled', applications.enabled ? 'true' : 'false');
    if (typeof applications.panelTitle === 'string') setSetting('global', 'staff_applications_title', applications.panelTitle.slice(0, 45));
    if (typeof applications.panelDescription === 'string') setSetting('global', 'staff_applications_description', applications.panelDescription.slice(0, 1000));
  }
  const tickets = settings.tickets;
  if (tickets) {
    const category = tickets.category ? findChannel(tickets.category) : null;
    if (category?.type === ChannelType.GuildCategory) setSetting('global', 'ticket_category_id', category.id);
    if (typeof tickets.panelTitle === 'string') setSetting('global', 'ticket_panel_title', tickets.panelTitle.slice(0, 256));
    if (typeof tickets.panelDescription === 'string') setSetting('global', 'ticket_panel_description', tickets.panelDescription.slice(0, 4000));
  }
}

export async function applyServerTemplate(guild, template, options = {}) {
  const { deleteUnlisted = false, expectedFingerprint = null } = options;
  const { fingerprint, plan } = await buildServerTemplatePlan(guild, template, deleteUnlisted);
  if (expectedFingerprint && fingerprint !== expectedFingerprint) {
    throw new Error('The Discord server changed after preview. Run Publish JSON again to review the updated deletion list.');
  }
  const created = [], updated = [], deleted = [], skipped = [];
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  for (const role of plan.createRoles) {
    try { const item = await guild.roles.create({ name: role.name, color: role.color, reason: 'Meta Code JSON setup sync' }); created.push('role ' + item.name); }
    catch (error) { throw new Error('Could not create role ' + role.name + ': ' + error.message); }
  }
  for (const role of plan.updateRoles) {
    try { const item = await guild.roles.fetch(role.id); if (item) { await item.edit({ color: role.color, reason: 'Meta Code JSON setup sync' }); updated.push('role ' + role.name); } }
    catch (error) { throw new Error('Could not update role ' + role.name + ': ' + error.message); }
  }
  await guild.roles.fetch();
  for (const definition of template.categories) {
    let category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name.toLowerCase() === definition.name.trim().toLowerCase());
    const overwrites = definition.private ? [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...['Founder','Administrator','Moderator','Support Team'].map(name => guild.roles.cache.find(role => role.name === name)).filter(Boolean)
        .map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
    ] : [];
    if (!category) {
      category = await guild.channels.create({ name: definition.name.trim(), type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: 'Meta Code JSON setup sync' });
      created.push('category ' + category.name);
    } else {
      await category.edit({ permissionOverwrites: overwrites, reason: 'Meta Code JSON setup sync' });
      updated.push('category permissions ' + category.name);
    }
  }
  await guild.channels.fetch();
  for (const definition of desiredChannelDefinitions(template)) {
    const category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name.toLowerCase() === definition.categoryName.toLowerCase());
    let channel = guild.channels.cache.find(item => item.type === definition.type && item.name.toLowerCase() === definition.name);
    if (!channel) {
      channel = await guild.channels.create({ name: definition.name, type: definition.type, parent: category?.id, reason: 'Meta Code JSON setup sync' });
      if (category && typeof channel.lockPermissions === 'function') await channel.lockPermissions();
      created.push('channel ' + channel.name);
    } else if (category && channel.parentId !== category.id) {
      await channel.setParent(category.id, { lockPermissions: true, reason: 'Meta Code JSON setup sync' });
      updated.push('moved and synced permissions for ' + channel.name + ' to ' + definition.categoryName);
    } else if (category && typeof channel.lockPermissions === 'function') {
      await channel.lockPermissions();
      updated.push('synced permissions for ' + channel.name);
    } else {
      skipped.push('channel ' + channel.name);
    }
  }
  if (deleteUnlisted) {
    await guild.channels.fetch();
    for (const stale of plan.deleteChannels) {
      const channel = await guild.channels.fetch(stale.id).catch(() => null);
      if (!channel) continue;
      try { await channel.delete('Not present in the confirmed Meta Code JSON template'); deleted.push('channel ' + stale.name); }
      catch (error) { throw new Error('Could not delete channel ' + stale.name + ': ' + error.message); }
    }
    for (const stale of plan.deleteCategories) {
      const category = await guild.channels.fetch(stale.id).catch(() => null);
      if (!category) continue;
      try { await category.delete('Not present in the confirmed Meta Code JSON template'); deleted.push('category ' + stale.name); }
      catch (error) { throw new Error('Could not delete category ' + stale.name + ': ' + error.message); }
    }
    for (const stale of plan.deleteRoles) {
      const role = await guild.roles.fetch(stale.id).catch(() => null);
      if (!role) continue;
      try { await role.delete('Not present in the confirmed Meta Code JSON template'); deleted.push('role ' + stale.name); }
      catch (error) { throw new Error('Could not delete role ' + stale.name + ': ' + error.message); }
    }
  }
  await applyTemplateSettings(guild, template);
  return { created, updated, deleted, skipped, errors: [], protectedRoles: plan.protectedRoles, protectedChannels: plan.protectedChannels };
}

export async function previewServerTemplate(guild, template) {
  const { fingerprint, plan } = await buildServerTemplatePlan(guild, template, true);
  return {
    fingerprint,
    summary: {
      createRoles: plan.createRoles,
      updateRoles: plan.updateRoles,
      deleteRoles: plan.deleteRoles,
      protectedRoles: plan.protectedRoles,
      createCategories: plan.createCategories,
      updateCategories: plan.updateCategories,
      deleteCategories: plan.deleteCategories,
      createChannels: plan.createChannels,
      moveChannels: plan.moveChannels,
      deleteChannels: plan.deleteChannels,
      syncChannelPermissions: plan.syncChannelPermissions,
      protectedChannels: plan.protectedChannels
    }
  };
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
    return interaction.editReply('✅ **Meta Code setup applied safely.**\nCreated: ' + result.created.length + '\nUpdated: ' + result.updated.length + '\nDeleted: ' + result.deleted.length + '\nAlready matched: ' + result.skipped.length + '\nExisting channels and messages were preserved.');
  } catch (error) { return interaction.editReply('Setup failed: ' + error.message); }
}



export async function handleServerSetupButton(interaction) {
  return interaction.reply({ content: 'This setup confirmation is no longer used. Publish a template from the owner dashboard or run /setup-server.', ephemeral: true });
}

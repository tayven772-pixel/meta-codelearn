import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { getSetting, setSetting } from './database.js';

export const serverSetupCommand = new SlashCommandBuilder()
  .setName('setup-server')
  .setDescription('Apply the saved Meta Code server template')
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
  { name: '📍 GET STARTED', channels: [['text', 'welcome'], ['text', 'rules'], ['text', 'announcements'], ['text', 'official-links'], ['text', 'choose-roles']] },
  { name: '💬 COMMUNITY', channels: [['text', 'general-chat'], ['text', 'introductions'], ['text', 'questions'], ['text', 'ideas-and-feedback'], ['text', 'project-showcase'], ['text', 'partner-advertisements']] },
  { name: '💻 LEARN AND BUILD', channels: [['text', 'learning-resources'], ['text', 'web-development'], ['text', 'discord-bots'], ['text', 'coding-challenges'], ['text', 'github-and-projects']] },
  { name: '🛟 META SUPPORT', channels: [['text', 'open-a-ticket'], ['text', 'bug-reports'], ['text', 'suggestions']] },
  { name: '🔊 VOICE LOUNGE', channels: [['voice', 'community-lounge'], ['voice', 'coding-together'], ['voice', 'afk']] },
  { name: '🔐 STAFF HQ', private: true, channels: [['text', 'staff-chat'], ['text', 'staff-applications'], ['text', 'ticket-logs'], ['text', 'moderation-logs']] }
];

const defaultBotControl = {
  dashboard: {
    title: 'Meta Code bot control',
    description: 'Manage the bot and its Discord server layout.',
    sections: ['serverSetup', 'commands', 'responses', 'tickets', 'messages', 'community', 'staffApplications', 'autopartner']
  },
  welcome: { channel: 'welcome', showAvatar: true, message: 'Welcome {user} to {server}! You are member #{membercount}.' },
  staffApplications: {
    reviewChannel: 'staff-applications',
    reviewRole: 'Support Team',
    questions: [
      'Name you would like staff to use',
      'Which role are you applying for?',
      'Why do you want to help Meta Code?',
      'What experience or skills would you bring?',
      'How would you handle a community conflict?'
    ]
  },
  autopartner: { enabled: true, channel: 'partner-advertisements', intervalHours: 24, minimumMembers: 100 }
};

function normalizeChannelName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'new-channel';
}

export function validateServerTemplate(template) {
  if (!template || typeof template !== 'object' || !Array.isArray(template.roles) || !Array.isArray(template.categories)) {
    throw new Error('Template must contain roles and categories arrays.');
  }
  if (template.roles.length > 40 || template.categories.length > 30 ||
      template.roles.some(role => !role || typeof role.name !== 'string' || !role.name.trim() || role.name.length > 100 ||
        (role.color !== undefined && (!Number.isInteger(role.color) || role.color < 0 || role.color > 0xFFFFFF))) ||
      template.categories.some(group => !group || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 100 ||
        !Array.isArray(group.channels) || group.channels.length > 50 ||
        group.channels.some(channel => !Array.isArray(channel) || !['text', 'voice'].includes(channel[0]) ||
          typeof channel[1] !== 'string' || !channel[1].trim() || channel[1].length > 100))) {
    throw new Error('Invalid template structure or values.');
  }

  const control = template.botControl ?? {};
  if (!control || typeof control !== 'object' || Array.isArray(control)) throw new Error('botControl must be an object.');
  const dashboard = control.dashboard ?? {};
  const validSections = new Set(['serverSetup', 'commands', 'responses', 'tickets', 'messages', 'community', 'staffApplications', 'autopartner']);
  if (dashboard.sections !== undefined &&
      (!Array.isArray(dashboard.sections) || dashboard.sections.length > validSections.size || dashboard.sections.some(section => !validSections.has(section)))) {
    throw new Error('botControl.dashboard.sections contains an unknown dashboard section.');
  }
  if (dashboard.title !== undefined && (typeof dashboard.title !== 'string' || dashboard.title.length > 80)) throw new Error('Dashboard title must be 80 characters or fewer.');
  if (dashboard.description !== undefined && (typeof dashboard.description !== 'string' || dashboard.description.length > 240)) throw new Error('Dashboard description must be 240 characters or fewer.');

  const welcome = control.welcome ?? {};
  if (welcome.message !== undefined && (typeof welcome.message !== 'string' || welcome.message.length > 1500)) throw new Error('Welcome message must be 1500 characters or fewer.');
  if (welcome.showAvatar !== undefined && typeof welcome.showAvatar !== 'boolean') throw new Error('welcome.showAvatar must be true or false.');

  const applications = control.staffApplications ?? {};
  if (applications.approvedRole !== undefined &&
      (typeof applications.approvedRole !== 'string' || applications.approvedRole.length > 100)) {
    throw new Error('staffApplications.approvedRole must be a role name of 100 characters or fewer.');
  }
  if (applications.questions !== undefined &&
      (!Array.isArray(applications.questions) || applications.questions.length < 1 || applications.questions.length > 5 ||
       applications.questions.some(question => typeof question !== 'string' || !question.trim() || question.length > 45))) {
    throw new Error('Staff application questions must contain 1–5 non-empty questions, each 45 characters or fewer.');
  }

  const partner = control.autopartner ?? {};
  if (partner.enabled !== undefined && typeof partner.enabled !== 'boolean') throw new Error('autopartner.enabled must be true or false.');
  if (partner.intervalHours !== undefined && (!Number.isInteger(partner.intervalHours) || partner.intervalHours < 6 || partner.intervalHours > 168)) throw new Error('autopartner.intervalHours must be 6–168.');
  if (partner.minimumMembers !== undefined && (!Number.isInteger(partner.minimumMembers) || partner.minimumMembers < 1 || partner.minimumMembers > 10000000)) throw new Error('autopartner.minimumMembers must be between 1 and 10,000,000.');

  for (const [groupName, key] of [
    [welcome, 'channel'],
    [applications, 'reviewChannel'],
    [applications, 'reviewRole'],
    [partner, 'channel']
  ]) {
    if (groupName[key] !== undefined && (typeof groupName[key] !== 'string' || groupName[key].length > 100)) {
      throw new Error('botControl channel and role names must be strings of 100 characters or fewer.');
    }
  }
  return template;
}

function findChannelByName(guild, name, allowedTypes = null) {
  const clean = normalizeChannelName(name);
  return guild.channels.cache.find(channel =>
    channel.name.toLowerCase() === clean &&
    (!allowedTypes || allowedTypes.includes(channel.type))
  ) ?? null;
}

function applyBotControlSettings(guild, template) {
  const control = { ...defaultBotControl, ...(template.botControl ?? {}) };
  const welcome = { ...defaultBotControl.welcome, ...(control.welcome ?? {}) };
  const applications = { ...defaultBotControl.staffApplications, ...(control.staffApplications ?? {}) };
  const partner = { ...defaultBotControl.autopartner, ...(control.autopartner ?? {}) };
  const textTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

  const welcomeChannel = findChannelByName(guild, welcome.channel, textTypes);
  setSetting('global', 'community_welcome_channel_id', welcomeChannel?.id || '');
  setSetting('global', 'community_welcome_message', welcome.message);
  setSetting('global', 'community_welcome_avatar', String(welcome.showAvatar !== false));

  const reviewChannel = findChannelByName(guild, applications.reviewChannel, textTypes);
  setSetting('global', 'staff_application_review_channel_id', reviewChannel?.id || '');
  const reviewRole = guild.roles.cache.find(role => role.name.toLowerCase() === String(applications.reviewRole).trim().toLowerCase());
  setSetting('global', 'staff_application_review_role_id', reviewRole?.id || '');
  const approvedRole = applications.approvedRole
    ? guild.roles.cache.find(role => role.name.toLowerCase() === String(applications.approvedRole).trim().toLowerCase())
    : null;
  setSetting('global', 'staff_application_approved_role_id', approvedRole?.id || '');
  setSetting('global', 'staff_application_questions', JSON.stringify(applications.questions ?? defaultBotControl.staffApplications.questions));

  const partnerChannel = findChannelByName(guild, partner.channel, textTypes);
  setSetting('global', 'autopartner_channel_id', partnerChannel?.id || '');
  setSetting('global', 'autopartner_enabled', String(partner.enabled !== false));
  setSetting('global', 'autopartner_interval_hours', String(partner.intervalHours ?? 24));
  setSetting('global', 'autopartner_min_members', String(partner.minimumMembers ?? 100));
  setSetting('global', 'bot_dashboard_config', JSON.stringify(control.dashboard ?? defaultBotControl.dashboard));
}

export async function previewServerTemplate(guild, template) {
  validateServerTemplate(template);
  await guild.roles.fetch();
  await guild.channels.fetch();

  const desiredRoles = new Set(template.roles.map(role => role.name.trim().toLowerCase()));
  const desiredCategories = new Map();
  for (const group of template.categories) {
    const categoryName = group.name.trim();
    const category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name === categoryName);
    desiredCategories.set(categoryName, category ?? null);
  }

  const plannedChannelIds = new Set();
  const createChannels = [];
  for (const [categoryName, group] of desiredCategories) {
    const category = group;
    const definition = template.categories.find(item => item.name.trim() === categoryName);
    for (const [kind, rawName] of definition.channels) {
      const name = normalizeChannelName(rawName);
      const type = kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
      const existing = guild.channels.cache.find(channel => !plannedChannelIds.has(channel.id) && channel.type === type && channel.name === name);
      if (existing) plannedChannelIds.add(existing.id);
      else createChannels.push({ category: categoryName, name, kind });
    }
  }

  const desiredCategoryNames = new Set(template.categories.map(group => group.name.trim()));
  const deleteChannels = guild.channels.cache.filter(channel =>
    channel.type !== ChannelType.GuildCategory && !plannedChannelIds.has(channel.id)
  );
  const deleteCategories = guild.channels.cache.filter(channel =>
    channel.type === ChannelType.GuildCategory && !desiredCategoryNames.has(channel.name)
  );

  const botMember = guild.members.me ?? await guild.members.fetchMe();
  const botHighest = botMember.roles.highest.position;
  const deleteRoles = guild.roles.cache.filter(role =>
    role.id !== guild.id &&
    !role.managed &&
    role.position < botHighest &&
    !desiredRoles.has(role.name.toLowerCase())
  );
  const protectedRoles = guild.roles.cache.filter(role =>
    role.id !== guild.id &&
    (role.managed || role.position >= botHighest) &&
    !desiredRoles.has(role.name.toLowerCase())
  );

  return {
    createRoles: template.roles.filter(definition => !guild.roles.cache.some(role => role.name.toLowerCase() === definition.name.trim().toLowerCase())).map(role => role.name),
    updateRoles: template.roles.filter(definition => guild.roles.cache.some(role => role.name.toLowerCase() === definition.name.trim().toLowerCase() && definition.color !== undefined && role.color !== definition.color)).map(role => role.name),
    createCategories: template.categories.filter(group => !desiredCategories.get(group.name.trim())).map(group => group.name),
    createChannels,
    deleteChannels: deleteChannels.map(channel => ({ id: channel.id, name: channel.name, type: channel.type })),
    deleteCategories: deleteCategories.map(channel => ({ id: channel.id, name: channel.name })),
    deleteRoles: deleteRoles.map(role => ({ id: role.id, name: role.name })),
    protectedRoles: protectedRoles.map(role => role.name)
  };
}

export async function applyServerTemplate(guild, template) {
  validateServerTemplate(template);
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Meta needs Manage Channels and Manage Roles permissions.');
  }

  await guild.roles.fetch();
  await guild.channels.fetch();
  const plan = await previewServerTemplate(guild, template);
  const created = [], updated = [], skipped = [], deleted = [], protectedItems = [], errors = [];

  // Create/update desired roles first so private category access can be applied.
  for (const definition of template.roles) {
    try {
      let role = guild.roles.cache.find(item => item.name.toLowerCase() === definition.name.trim().toLowerCase());
      if (!role) {
        role = await guild.roles.create({ name: definition.name.trim(), color: definition.color ?? 0xD7DCE4, reason: 'Published Meta Code server template' });
        created.push('role ' + role.name);
      } else if (definition.color !== undefined && role.color !== definition.color) {
        await role.edit({ color: definition.color, reason: 'Published Meta Code server template' });
        updated.push('role ' + role.name);
      } else {
        skipped.push('role ' + role.name);
      }
    } catch (error) {
      errors.push('Role ' + definition.name + ': ' + error.message);
    }
  }

  // Create/reconcile categories and all desired channels before removing old channels.
  const desiredChannelIds = new Set();
  const desiredCategoryIds = new Set();
  for (const group of template.categories) {
    try {
      let category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name === group.name.trim());
      if (!category) {
        category = await guild.channels.create({ name: group.name.trim(), type: ChannelType.GuildCategory, reason: 'Published Meta Code server template' });
        created.push('category ' + category.name);
      }

      desiredCategoryIds.add(category.id);
      const overwrites = group.private ? [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...['Founder', 'Administrator', 'Moderator', 'Support Team']
          .map(name => guild.roles.cache.find(role => role.name.toLowerCase() === name.toLowerCase()))
          .filter(Boolean)
          .map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
      ] : [];
      await category.permissionOverwrites.set(overwrites, 'Published Meta Code server template');
      updated.push('category permissions ' + category.name);

      for (const [kind, rawName] of group.channels) {
        const name = normalizeChannelName(rawName);
        const type = kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
        let channel = guild.channels.cache.find(item => !desiredChannelIds.has(item.id) && item.type === type && item.name === name);
        if (!channel) {
          channel = await guild.channels.create({ name, type, parent: category.id, reason: 'Published Meta Code server template' });
          created.push('channel ' + name);
        } else {
          if (channel.parentId !== category.id) {
            await channel.setParent(category.id, { lockPermissions: true, reason: 'Published Meta Code server template' });
            updated.push('moved channel ' + name);
          } else {
            // Match the category's permission overwrites exactly.
            await channel.lockPermissions().catch(() => {});
            skipped.push('channel ' + name);
          }
        }
        desiredChannelIds.add(channel.id);
      }
    } catch (error) {
      errors.push('Category ' + group.name + ': ' + error.message);
    }
  }

  // Safety gate: never remove existing server content if any desired role,
  // category, permission or channel could not be prepared successfully.
  // The owner can fix permissions/names and retry without losing the old layout.
  if (errors.length) {
    return {
      created, updated, skipped, deleted, protected: protectedItems, errors,
      plan: {
        deleteChannels: plan.deleteChannels.length,
        deleteCategories: plan.deleteCategories.length,
        deleteRoles: plan.deleteRoles.length,
        protectedRoles: plan.protectedRoles.length
      },
      deletionsSkipped: true
    };
  }

  // Replace mode: remove every non-template channel and category. Deleting a
  // channel permanently removes its message history and any threads beneath it.
  for (const channel of guild.channels.cache.filter(item =>
    item.type !== ChannelType.GuildCategory && !desiredChannelIds.has(item.id)
  ).values()) {
    try {
      await channel.delete('Removed by published Meta Code server template');
      deleted.push('channel ' + channel.name);
    } catch (error) {
      errors.push('Delete channel ' + channel.name + ': ' + error.message);
    }
  }

  for (const category of guild.channels.cache.filter(item =>
    item.type === ChannelType.GuildCategory && !desiredCategoryIds.has(item.id)
  ).values()) {
    try {
      await category.delete('Removed by published Meta Code server template');
      deleted.push('category ' + category.name);
    } catch (error) {
      errors.push('Delete category ' + category.name + ': ' + error.message);
    }
  }

  // Delete unused, unmanaged roles below the bot's highest role. @everyone,
  // integration/bot roles and roles above the bot are deliberately protected.
  const botHighest = botMember.roles.highest.position;
  const desiredRoleNames = new Set(template.roles.map(role => role.name.trim().toLowerCase()));
  for (const role of guild.roles.cache.filter(item =>
    item.id !== guild.id && !item.managed && item.position < botHighest && !desiredRoleNames.has(item.name.toLowerCase())
  ).values()) {
    try {
      await role.delete('Removed by published Meta Code server template');
      deleted.push('role ' + role.name);
    } catch (error) {
      errors.push('Delete role ' + role.name + ': ' + error.message);
    }
  }
  for (const role of guild.roles.cache.filter(item =>
    item.id !== guild.id && (item.managed || item.position >= botHighest) && !desiredRoleNames.has(item.name.toLowerCase())
  ).values()) {
    protectedItems.push('role ' + role.name);
  }

  applyBotControlSettings(guild, template);
  return {
    created, updated, skipped, deleted, protected: protectedItems,
    errors, plan: {
      deleteChannels: plan.deleteChannels.length,
      deleteCategories: plan.deleteCategories.length,
      deleteRoles: plan.deleteRoles.length,
      protectedRoles: plan.protectedRoles.length
    }
  };
}

export async function handleServerSetup(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'Run this command inside your Discord server.', ephemeral: true });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const saved = getSetting('global', 'server_setup_template') || getSetting(interaction.guild.id, 'server_setup_template');
  let template = null;
  if (saved) { try { template = JSON.parse(saved); } catch { /* use built-in fallback */ } }
  if (!template) template = { roles: roleDefinitions, categories: layout, botControl: defaultBotControl };
  try {
    const plan = await previewServerTemplate(interaction.guild, template);
    await interaction.editReply(
      '⚠️ **Replacement plan**\n' +
      'Create roles: ' + plan.createRoles.length + '\n' +
      'Create categories: ' + plan.createCategories.length + '\n' +
      'Create channels: ' + plan.createChannels.length + '\n' +
      'Delete channels: ' + plan.deleteChannels.length + '\n' +
      'Delete categories: ' + plan.deleteCategories.length + '\n' +
      'Delete roles: ' + plan.deleteRoles.length + '\n' +
      'Protected roles (cannot be deleted by Meta): ' + plan.protectedRoles.length + '\n\n' +
      'This command is preview-only. Use the owner dashboard to publish the template after reviewing the destructive changes.'
    );
  } catch (error) {
    await interaction.editReply('Setup preview failed: ' + error.message);
  }
}

export async function handleServerSetupButton(interaction) {
  return interaction.reply({ content: 'The server setup confirmation is now handled from the owner dashboard.', ephemeral: true });
}

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  ChannelType
} from 'discord.js';
import { getSetting, setSetting } from './database.js';
import { publishTicketPanel } from './tickets.js';

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

function parseTemplateColor(value, label = 'color') {
  if (Number.isInteger(value) && value >= 0 && value <= 0xFFFFFF) return value;
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) return Number.parseInt(value.slice(1), 16);
  throw new Error(label + ' must be a 6-digit hex color such as #5865F2.');
}

function permissionBits(names, label) {
  if (names === undefined) return undefined;
  if (typeof names === 'bigint') return names;
  if (!Array.isArray(names)) throw new Error(label + ' must be an array of Discord permission names.');
  if (names.every(name => typeof name === 'bigint')) return new PermissionsBitField(names).bitfield;
  const bits = [];
  for (const name of names) {
    if (typeof name !== 'string' || !Object.hasOwn(PermissionFlagsBits, name)) {
      throw new Error(label + ' contains an unknown Discord permission: ' + String(name));
    }
    bits.push(PermissionFlagsBits[name]);
  }
  return new PermissionsBitField(bits).bitfield;
}

const CHANNEL_OVERWRITE_FLAGS = new Set([
  'CreateInstantInvite','ManageChannels','AddReactions','ViewChannel','SendMessages',
  'SendTTSMessages','ManageMessages','EmbedLinks','AttachFiles','ReadMessageHistory',
  'MentionEveryone','UseExternalEmojis','Connect','Speak','MuteMembers','DeafenMembers',
  'MoveMembers','UseVAD','ManageWebhooks','UseApplicationCommands','ManageThreads',
  'CreatePublicThreads','CreatePrivateThreads','SendMessagesInThreads','UseExternalStickers',
  'UseEmbeddedActivities','UseSoundboard','UseExternalSounds','SendVoiceMessages','SendPolls'
]);

function normalizeServerTemplate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const branding = input.branding && typeof input.branding === 'object' ? input.branding : {};
  const botSettings = input.bot_settings && typeof input.bot_settings === 'object' ? input.bot_settings : {};
  const roles = Array.isArray(input.roles) ? input.roles.map(role => ({
    ...role,
    color: role?.color === undefined ? undefined : parseTemplateColor(role.color, 'Role "' + (role.name || 'unnamed') + '" color'),
    permissions: permissionBits(role?.permissions, 'Role "' + (role?.name || 'unnamed') + '" permissions')
  })) : input.roles;
  const categories = Array.isArray(input.categories) ? input.categories.map(group => ({
    ...group,
    channels: Array.isArray(group?.channels) ? group.channels.map(channel => {
      if (Array.isArray(channel)) return channel;
      if (!channel || typeof channel !== 'object') return channel;
      return [channel.type, channel.name, {
        read_only: channel.read_only === true,
        bot_panel: channel.bot_panel
      }];
    }) : group?.channels
  })) : input.categories;

  const welcome = botSettings.welcome;
  const logging = botSettings.logging;
  const ticket = botSettings.tickets;
  const partnership = botSettings.partnerships;
  const leveling = botSettings.leveling;
  const giveaways = botSettings.giveaways;
  const selfRoles = botSettings.self_roles;
  const automod = botSettings.automod;
  const legacy = input.botControl ?? {};
  const botControl = {
    ...legacy,
    welcome: welcome ? {
      ...(legacy.welcome ?? {}),
      ...(welcome.channel !== undefined ? { channel: welcome.channel } : {}),
      ...(welcome.message !== undefined ? { message: welcome.message } : {}),
      ...(welcome.enabled !== undefined ? { enabled: welcome.enabled } : {})
    } : legacy.welcome,
    autopartner: partnership ? {
      ...(legacy.autopartner ?? {}),
      enabled: partnership.enabled !== undefined ? partnership.enabled : legacy.autopartner?.enabled,
      intervalHours: partnership.cooldown_hours !== undefined ? partnership.cooldown_hours : legacy.autopartner?.intervalHours,
      channel: legacy.autopartner?.channel || 'partnership-requests'
    } : legacy.autopartner
  };

  return {
    ...input,
    serverName: input.serverName ?? branding.server_name,
    roles,
    categories,
    botControl,
    __templateMeta: {
      name: input.template_name || '',
      version: input.template_version || '',
      description: input.description || '',
      branding: {
        botName: branding.bot_name || '',
        embedColor: branding.embed_color ? parseTemplateColor(branding.embed_color, 'branding.embed_color') : 0x5865F2,
        footer: branding.footer || ''
      },
      permissions: input.permissions ?? {},
      botSettings: { welcome, autorole: botSettings.autorole, logging, ticket, leveling, giveaways, selfRoles, partnership, automod },
      placeholders: input.placeholders ?? {}
    }
  };
}

function supportedTypesForKind(kind) {
  return kind === 'voice'
    ? [ChannelType.GuildVoice]
    : [ChannelType.GuildText, ChannelType.GuildAnnouncement];
}

export function validateServerTemplate(input) {
  const template = normalizeServerTemplate(input);
  if (!template || typeof template !== 'object' || !Array.isArray(template.roles) || !Array.isArray(template.categories)) {
    throw new Error('Template must contain roles and categories arrays.');
  }
  if (template.serverName !== undefined &&
      (typeof template.serverName !== 'string' || template.serverName.trim().length < 2 || template.serverName.trim().length > 100)) {
    throw new Error('serverName must be 2–100 characters when provided. Omit it to keep the current server name.');
  }
  if (template.roles.length > 40 || template.categories.length > 30 ||
      template.roles.some(role => !role || typeof role.name !== 'string' || !role.name.trim() || role.name.length > 100 ||
        (role.color !== undefined && (!Number.isInteger(role.color) || role.color < 0 || role.color > 0xFFFFFF)) ||
        (role.hoist !== undefined && typeof role.hoist !== 'boolean')) ||
      template.categories.some(group => !group || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 100 ||
        !Array.isArray(group.channels) || group.channels.length > 50 ||
        group.channels.some(channel => !Array.isArray(channel) || !['text', 'voice'].includes(channel[0]) ||
          typeof channel[1] !== 'string' || !channel[1].trim() || channel[1].length > 100 ||
          (channel[2] !== undefined && (!channel[2] || typeof channel[2] !== 'object' || Array.isArray(channel[2])))))) {
    throw new Error('Invalid template structure or values.');
  }
  const roleNames = template.roles.map(role => role.name.trim().toLowerCase());
  const categoryNames = template.categories.map(group => group.name.trim().toLowerCase());
  if (new Set(roleNames).size !== roleNames.length) throw new Error('Role names must be unique (case-insensitive).');
  if (new Set(categoryNames).size !== categoryNames.length) throw new Error('Category names must be unique (case-insensitive).');
  for (const group of template.categories) {
    const channelKeys = group.channels.map(([kind, name]) => kind + ':' + normalizeChannelName(name));
    if (group.allowed_roles !== undefined && (!Array.isArray(group.allowed_roles) || group.allowed_roles.some(name => typeof name !== 'string' || !name.trim()))) {
      throw new Error('Category "' + group.name + '" allowed_roles must be an array of role names.');
    }
    if (new Set(channelKeys).size !== channelKeys.length) {
      throw new Error('Category "' + group.name + '" contains duplicate channel names of the same type.');
    }
  }

  const control = template.botControl ?? {};
  if (!control || typeof control !== 'object' || Array.isArray(control)) throw new Error('botControl must be an object.');
  for (const [key, section] of Object.entries({
    dashboard: control.dashboard,
    welcome: control.welcome,
    staffApplications: control.staffApplications,
    autopartner: control.autopartner
  })) {
    if (section !== undefined && (!section || typeof section !== 'object' || Array.isArray(section))) {
      throw new Error('botControl.' + key + ' must be an object.');
    }
  }
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

  const configuredApplications = control.staffApplications ?? {};
  const applications = { ...defaultBotControl.staffApplications, ...configuredApplications };
  if (applications.approvedRole !== undefined &&
      (typeof applications.approvedRole !== 'string' || applications.approvedRole.length > 100)) {
    throw new Error('staffApplications.approvedRole must be a role name of 100 characters or fewer.');
  }
  if (applications.questions !== undefined &&
      (!Array.isArray(applications.questions) || applications.questions.length < 1 || applications.questions.length > 5 ||
       applications.questions.some(question => typeof question !== 'string' || !question.trim() || question.length > 45))) {
    throw new Error('Staff application questions must contain 1–5 non-empty questions, each 45 characters or fewer.');
  }
  const definedRoleNames = new Set(template.roles.map(role => role.name.trim().toLowerCase()));
  if (configuredApplications.reviewRole && !definedRoleNames.has(String(configuredApplications.reviewRole).trim().toLowerCase())) {
    throw new Error('Staff application reviewer role "' + configuredApplications.reviewRole + '" must also be listed in the JSON roles array.');
  }
  if (configuredApplications.approvedRole && !definedRoleNames.has(String(configuredApplications.approvedRole).trim().toLowerCase())) {
    throw new Error('Staff application approvedRole must also be listed in the JSON roles array.');
  }
  const privateGroups = template.categories.filter(group => group.private === true);
  const meta = template.__templateMeta ?? {};
  const structuredPermissions = meta.permissions ?? {};
  for (const [scope, config] of Object.entries({
    everyone: structuredPermissions.everyone,
    read_only_channels: structuredPermissions.read_only_channels,
    staff_category: structuredPermissions.staff_category,
    muted_role: structuredPermissions.muted_role
  })) {
    if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config))) {
      throw new Error('permissions.' + scope + ' must be an object.');
    }
  }
  for (const [label, config] of [
    ['permissions.everyone', structuredPermissions.everyone],
    ['permissions.read_only_channels', structuredPermissions.read_only_channels],
    ['permissions.muted_role', structuredPermissions.muted_role]
  ]) {
    if (!config) continue;
    if (config.allow !== undefined) permissionBits(config.allow, label + '.allow');
    if (config.deny !== undefined) permissionBits(config.deny, label + '.deny');
  }
  if (structuredPermissions.read_only_channels?.channels !== undefined &&
      (!Array.isArray(structuredPermissions.read_only_channels.channels) ||
       structuredPermissions.read_only_channels.channels.some(name => typeof name !== 'string'))) {
    throw new Error('permissions.read_only_channels.channels must be an array of channel names.');
  }
  if (structuredPermissions.staff_category?.allowed_roles !== undefined &&
      (!Array.isArray(structuredPermissions.staff_category.allowed_roles) ||
       structuredPermissions.staff_category.allowed_roles.some(name => typeof name !== 'string'))) {
    throw new Error('permissions.staff_category.allowed_roles must be an array of role names.');
  }
  for (const group of template.categories) {
    for (const [kind, channelName, options] of group.channels) {
      if (options?.read_only !== undefined && typeof options.read_only !== 'boolean') {
        throw new Error('Channel ' + channelName + ' read_only must be true or false.');
      }
      if (options?.bot_panel !== undefined && !['tickets', 'logging'].includes(options.bot_panel)) {
        throw new Error('Channel ' + channelName + ' has an unknown bot_panel. Supported panels: tickets, logging.');
      }
    }
  }
  if (privateGroups.length) {
    const configuredPrivateRoles = privateGroups.flatMap(group => group.allowed_roles ?? []);
    const accessRoleNames = new Set(['Founder', 'Administrator', 'Moderator', 'Support Team', String(applications.reviewRole || ''), ...configuredPrivateRoles]
      .map(name => name.trim().toLowerCase()).filter(Boolean));
    if (!template.roles.some(role => accessRoleNames.has(role.name.trim().toLowerCase()))) {
      throw new Error('Private categories need at least one staff role from the JSON roles array so staff are not locked out.');
    }
  }

  const partner = control.autopartner ?? {};
  if (partner.enabled !== undefined && typeof partner.enabled !== 'boolean') throw new Error('autopartner.enabled must be true or false.');
  if (partner.intervalHours !== undefined && (!Number.isInteger(partner.intervalHours) || partner.intervalHours < 6 || partner.intervalHours > 168)) throw new Error('autopartner.intervalHours must be 6–168.');
  if (partner.minimumMembers !== undefined && (!Number.isInteger(partner.minimumMembers) || partner.minimumMembers < 1 || partner.minimumMembers > 10000000)) throw new Error('autopartner.minimumMembers must be between 1 and 10,000,000.');

  for (const [groupName, key] of [
    [welcome, 'channel'],
    [applications, 'reviewChannel'],
    [applications, 'reviewRole'],
    [applications, 'approvedRole'],
    [partner, 'channel']
  ]) {
    if (groupName[key] !== undefined && (typeof groupName[key] !== 'string' || groupName[key].length > 100)) {
      throw new Error('botControl channel and role names must be strings of 100 characters or fewer.');
    }
  }
  const hasTextChannel = name => {
    const target = normalizeChannelName(name);
    return template.categories.some(group => group.channels.some(([kind, rawName]) =>
      kind === 'text' && normalizeChannelName(rawName) === target
    ));
  };
  if (control.welcome?.channel && !hasTextChannel(control.welcome.channel)) {
    throw new Error('botControl.welcome.channel must point to a text channel listed in the JSON categories.');
  }
  if (control.staffApplications?.reviewChannel && !hasTextChannel(control.staffApplications.reviewChannel)) {
    throw new Error('botControl.staffApplications.reviewChannel must point to a text channel listed in the JSON categories.');
  }
  if (control.autopartner?.channel && !hasTextChannel(control.autopartner.channel)) {
    throw new Error('botControl.autopartner.channel must point to a text channel listed in the JSON categories.');
  }
  const botSettings = meta.botSettings ?? {};
  if (botSettings.welcome?.channel && !hasTextChannel(botSettings.welcome.channel)) throw new Error('bot_settings.welcome.channel must reference a text channel in categories.');
  if (botSettings.logging?.channel && !hasTextChannel(botSettings.logging.channel)) throw new Error('bot_settings.logging.channel must reference a text channel in categories.');
  if (botSettings.tickets?.panel_channel && !hasTextChannel(botSettings.tickets.panel_channel)) throw new Error('bot_settings.tickets.panel_channel must reference a text channel in categories.');
  if (botSettings.tickets?.transcript_channel && !hasTextChannel(botSettings.tickets.transcript_channel)) throw new Error('bot_settings.tickets.transcript_channel must reference a text channel in categories.');
  if (botSettings.tickets?.category && !template.categories.some(group => normalizeChannelName(group.name) === normalizeChannelName(String(botSettings.tickets.category)))) throw new Error('bot_settings.tickets.category must reference a category in categories.');
  const roleNameSet = new Set(template.roles.map(role => role.name.trim().toLowerCase()));
  for (const roleName of structuredPermissions.staff_category?.allowed_roles ?? []) {
    if (!roleNameSet.has(String(roleName).trim().toLowerCase())) throw new Error('permissions.staff_category references unknown role: ' + roleName);
  }
  if (meta.botSettings?.autorole?.role && !roleNameSet.has(String(meta.botSettings.autorole.role).trim().toLowerCase())) {
    throw new Error('bot_settings.autorole.role must reference a role in the roles array.');
  }
  for (const group of template.categories) for (const roleName of group.allowed_roles ?? []) {
    if (!roleNameSet.has(roleName.trim().toLowerCase())) throw new Error('Category "' + group.name + '" references an unknown allowed role: ' + roleName);
  }
  const booleanSettings = [
    ['welcome.enabled', meta.botSettings?.welcome?.enabled],
    ['autorole.enabled', meta.botSettings?.autorole?.enabled],
    ['logging.enabled', meta.botSettings?.logging?.enabled],
    ['leveling.enabled', meta.botSettings?.leveling?.enabled],
    ['leveling.level_up_messages', meta.botSettings?.leveling?.level_up_messages],
    ['leveling.leaderboard', meta.botSettings?.leveling?.leaderboard],
    ['giveaways.enabled', meta.botSettings?.giveaways?.enabled],
    ['giveaways.allow_early_end', meta.botSettings?.giveaways?.allow_early_end],
    ['self_roles.enabled', meta.botSettings?.selfRoles?.enabled],
    ['self_roles.allow_multiple', meta.botSettings?.selfRoles?.allow_multiple],
    ['partnerships.enabled', meta.botSettings?.partnership?.enabled],
    ['partnerships.approval_required', meta.botSettings?.partnership?.approval_required],
    ['automod.enabled', meta.botSettings?.automod?.enabled],
    ['automod.anti_spam', meta.botSettings?.automod?.anti_spam],
    ['automod.duplicate_message_filter', meta.botSettings?.automod?.duplicate_message_filter],
    ['automod.invite_filter', meta.botSettings?.automod?.invite_filter]
  ];
  for (const [label, value] of booleanSettings) if (value !== undefined && typeof value !== 'boolean') {
    throw new Error('bot_settings.' + label + ' must be true or false.');
  }
  if (meta.botSettings?.autorole?.role !== undefined &&
      (typeof meta.botSettings.autorole.role !== 'string' || meta.botSettings.autorole.role.length > 100)) {
    throw new Error('bot_settings.autorole.role must be a role name.');
  }
  if (meta.botSettings?.selfRoles?.selection_type !== undefined && meta.botSettings.selfRoles.selection_type !== 'dropdown') {
    throw new Error('bot_settings.self_roles.selection_type currently supports "dropdown".');
  }
  if (meta.botSettings?.giveaways?.default_winners !== undefined && (!Number.isInteger(meta.botSettings.giveaways.default_winners) || meta.botSettings.giveaways.default_winners < 1 || meta.botSettings.giveaways.default_winners > 10)) {
    throw new Error('bot_settings.giveaways.default_winners must be 1–10.');
  }
  if (meta.botSettings?.leveling?.xp_per_message !== undefined && (!Number.isInteger(meta.botSettings.leveling.xp_per_message) || meta.botSettings.leveling.xp_per_message < 1 || meta.botSettings.leveling.xp_per_message > 1000)) throw new Error('bot_settings.leveling.xp_per_message must be 1–1000.');
  if (meta.botSettings?.leveling?.cooldown_seconds !== undefined && (!Number.isInteger(meta.botSettings.leveling.cooldown_seconds) || meta.botSettings.leveling.cooldown_seconds < 1 || meta.botSettings.leveling.cooldown_seconds > 3600)) throw new Error('bot_settings.leveling.cooldown_seconds must be 1–3600.');
  if (meta.botSettings?.partnership?.cooldown_hours !== undefined && (!Number.isInteger(meta.botSettings.partnership.cooldown_hours) || meta.botSettings.partnership.cooldown_hours < 6 || meta.botSettings.partnership.cooldown_hours > 168)) throw new Error('bot_settings.partnerships.cooldown_hours must be 6–168.');
  if (meta.botSettings?.automod?.mention_limit !== undefined && (!Number.isInteger(meta.botSettings.automod.mention_limit) || meta.botSettings.automod.mention_limit < 1 || meta.botSettings.automod.mention_limit > 50)) throw new Error('bot_settings.automod.mention_limit must be 1–50.');
  if (meta.branding?.botName && meta.branding.botName.length > 32) throw new Error('branding.bot_name must be 32 characters or fewer because it is applied as the bot server nickname.');
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
  const preferredReviewerNames = [applications.reviewRole, 'Support Team', 'Moderator', 'Administrator', 'Founder']
    .filter(name => typeof name === 'string' && name.trim())
    .map(name => name.trim().toLowerCase());
  const reviewRole = preferredReviewerNames
    .map(name => guild.roles.cache.find(role => role.name.toLowerCase() === name))
    .find(Boolean);
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
  const meta = template.__templateMeta ?? {};
  const branding = meta.branding ?? {};
  if (branding.embedColor !== undefined) setSetting('global', 'bot_embed_color', String(branding.embedColor));
  if (branding.footer) setSetting('global', 'bot_embed_footer', branding.footer);
  if (branding.botName) setSetting('global', 'bot_brand_name', branding.botName);

  const botSettings = meta.botSettings ?? {};
  const configuredWelcome = botSettings.welcome;
  if (configuredWelcome) setSetting('global', 'community_welcome_enabled', String(configuredWelcome.enabled !== false));
  const autorole = botSettings.autorole;
  if (autorole) {
    const role = autorole.role ? guild.roles.cache.find(item => item.name.toLowerCase() === String(autorole.role).trim().toLowerCase()) : null;
    setSetting('global', 'community_autorole_id', autorole.enabled !== false ? (role?.id || '') : '');
  }
  const markedChannel = panel => template.categories.flatMap(group => group.channels).find(([, , options]) => options?.bot_panel === panel)?.[1] || '';
  const logging = botSettings.logging;
  if (logging) {
    const channel = (logging.channel || markedChannel('logging')) ? findChannelByName(guild, logging.channel || markedChannel('logging'), textTypes) : null;
    setSetting('global', 'community_log_channel_id', logging.enabled === false ? '' : (channel?.id || ''));
    setSetting('global', 'community_log_enabled', String(logging.enabled !== false));
    setSetting('global', 'community_log_events', JSON.stringify(Array.isArray(logging.events) ? logging.events : []));
  }
  const ticket = botSettings.tickets;
  if (ticket) {
    const panelChannelName = ticket.panel_channel || markedChannel('tickets');
    const channel = panelChannelName ? findChannelByName(guild, panelChannelName, textTypes) : null;
    const category = ticket.category ? guild.channels.cache.find(item =>
      item.type === ChannelType.GuildCategory &&
      normalizeChannelName(item.name) === normalizeChannelName(String(ticket.category))
    ) : null;
    const staffRole = guild.roles.cache.find(item => item.name.toLowerCase() === 'support team');
    const transcript = ticket.transcript_channel ? findChannelByName(guild, ticket.transcript_channel, textTypes) : null;
    setSetting('global', 'ticket_panel_channel_id', channel?.id || '');
    setSetting('global', 'ticket_category_id', category?.id || '');
    setSetting('global', 'ticket_staff_role_id', staffRole?.id || '');
    setSetting('global', 'ticket_log_channel_id', transcript?.id || '');
    setSetting('global', 'ticket_categories', JSON.stringify(Array.isArray(ticket.types) ? ticket.types : ['General Support']));
    setSetting('global', 'ticket_enabled', String(ticket.enabled !== false));
  }
  const leveling = botSettings.leveling;
  if (leveling) {
    setSetting('global', 'community_xp_enabled', String(leveling.enabled !== false));
    setSetting('global', 'community_xp_per_message', String(leveling.xp_per_message ?? 10));
    setSetting('global', 'community_xp_cooldown_seconds', String(leveling.cooldown_seconds ?? 60));
    setSetting('global', 'community_level_up_messages', String(leveling.level_up_messages !== false));
    setSetting('global', 'community_leaderboard_enabled', String(leveling.leaderboard !== false));
  }
  const giveaway = botSettings.giveaways;
  if (giveaway) {
    setSetting('global', 'community_giveaway_enabled', String(giveaway.enabled !== false));
    setSetting('global', 'community_giveaway_default_winners', String(giveaway.default_winners ?? 1));
    setSetting('global', 'community_giveaway_allow_early_end', String(giveaway.allow_early_end !== false));
  }
  const selfRoles = botSettings.selfRoles;
  if (selfRoles) {
    setSetting('global', 'community_self_roles_enabled', String(selfRoles.enabled !== false));
    setSetting('global', 'community_self_roles_selection_type', selfRoles.selection_type || 'dropdown');
    setSetting('global', 'community_self_roles_allow_multiple', String(selfRoles.allow_multiple !== false));
  }
  const partnership = botSettings.partnership;
  if (partnership) {
    setSetting('global', 'autopartner_enabled', String(partnership.enabled !== false));
    setSetting('global', 'autopartner_interval_hours', String(partnership.cooldown_hours ?? 24));
    setSetting('global', 'autopartner_approval_required', String(partnership.approval_required === true));
    const reviewName = logging?.channel || markedChannel('logging');
    const reviewChannel = reviewName ? findChannelByName(guild, reviewName, textTypes) : null;
    setSetting('global', 'autopartner_review_channel_id', reviewChannel?.id || '');
  }
  const automod = botSettings.automod;
  if (automod) {
    for (const [key, value] of Object.entries({
      automod_enabled: automod.enabled !== false,
      automod_anti_spam: automod.anti_spam !== false,
      automod_duplicate_filter: automod.duplicate_message_filter !== false,
      automod_invite_filter: automod.invite_filter === true,
      automod_mention_limit: automod.mention_limit ?? 5
    })) setSetting('global', key, String(value));
  }
}

export async function previewServerTemplate(guild, input) {
  const template = validateServerTemplate(input);
  await guild.roles.fetch();
  await guild.channels.fetch();

  const desiredRoles = new Set(template.roles.map(role => role.name.trim().toLowerCase()));
  const desiredCategories = new Map();
  for (const group of template.categories) {
    const categoryName = group.name.trim();
    const category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name.toLowerCase() === categoryName.toLowerCase());
    desiredCategories.set(categoryName, category ?? null);
  }

  const plannedChannelIds = new Set();
  const createChannels = [];
  const moveChannels = [];
  const desiredCategoryIds = new Set([...desiredCategories.values()].filter(Boolean).map(category => category.id));
  const updateCategories = [];
  for (const [categoryName, category] of desiredCategories) {
    if (category && category.name !== categoryName) updateCategories.push(categoryName);
    const definition = template.categories.find(item => item.name.trim() === categoryName);
    for (const [kind, rawName] of definition.channels) {
      const name = normalizeChannelName(rawName);
      const allowedTypes = supportedTypesForKind(kind);
      const existing = guild.channels.cache.find(channel => !plannedChannelIds.has(channel.id) && allowedTypes.includes(channel.type) && channel.name === name);
      if (existing) {
        plannedChannelIds.add(existing.id);
        if (!category || existing.parentId !== category.id) {
          moveChannels.push({ id: existing.id, name, fromCategoryId: existing.parentId, toCategory: categoryName });
        }
      } else {
        createChannels.push({ category: categoryName, name, kind });
      }
    }
  }

  const deleteChannels = guild.channels.cache.filter(channel =>
    channel.type !== ChannelType.GuildCategory && !plannedChannelIds.has(channel.id)
  );
  const deleteCategories = guild.channels.cache.filter(channel =>
    channel.type === ChannelType.GuildCategory && !desiredCategoryIds.has(channel.id)
  );

  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Meta needs Manage Channels and Manage Roles permissions before this template can be published.');
  }
  const requestedServerName = typeof template.serverName === 'string' ? template.serverName.trim() : '';
  const serverNameChange = requestedServerName && requestedServerName !== guild.name
    ? { current: guild.name, desired: requestedServerName }
    : null;
  if (serverNameChange && !botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('Meta needs Manage Server permission to rename this Discord server.');
  }
  const botHighest = botMember.roles.highest.position;
  const blockedDesiredRoles = template.roles.filter(definition => {
    const role = guild.roles.cache.find(item => item.name.toLowerCase() === definition.name.trim().toLowerCase());
    return role && (role.managed || role.position >= botHighest) &&
      (role.name !== definition.name.trim() || (definition.color !== undefined && role.color !== definition.color) ||
       (definition.hoist !== undefined && role.hoist !== (definition.hoist === true)) ||
       (definition.permissions !== undefined && role.permissions.bitfield !== definition.permissions));
  });
  if (blockedDesiredRoles.length) {
    throw new Error('Meta cannot update these template roles because they are managed or above its highest role: ' + blockedDesiredRoles.map(role => role.name).join(', '));
  }
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
    templateMetadata: {
      name: template.__templateMeta?.name || '',
      version: template.__templateMeta?.version || '',
      description: template.__templateMeta?.description || ''
    },
    createRoles: template.roles.filter(definition => !guild.roles.cache.some(role => role.name.toLowerCase() === definition.name.trim().toLowerCase())).map(role => role.name),
    updateRoles: template.roles.filter(definition => guild.roles.cache.some(role => role.name.toLowerCase() === definition.name.trim().toLowerCase() &&
      ((definition.color !== undefined && role.color !== definition.color) || role.name !== definition.name.trim() ||
       (definition.hoist !== undefined && role.hoist !== (definition.hoist === true)) ||
       (definition.permissions !== undefined && role.permissions.bitfield !== definition.permissions)))).map(role => role.name),
    createCategories: template.categories.filter(group => !desiredCategories.get(group.name.trim())).map(group => group.name),
    updateCategories,
    syncCategoryPermissions: template.categories.length,
    createChannels,
    moveChannels,
    deleteChannels: deleteChannels.map(channel => ({ id: channel.id, name: channel.name, type: channel.type })),
    deleteCategories: deleteCategories.map(channel => ({ id: channel.id, name: channel.name })),
    deleteRoles: deleteRoles.map(role => ({ id: role.id, name: role.name })),
    protectedRoles: protectedRoles.map(role => role.name),
    serverNameChange
  };
}

export async function applyServerTemplate(guild, input) {
  const template = validateServerTemplate(input);
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Meta needs Manage Channels and Manage Roles permissions.');
  }

  await guild.roles.fetch();
  await guild.channels.fetch();
  const plan = await previewServerTemplate(guild, template);
  const created = [], updated = [], skipped = [], deleted = [], protectedItems = [], errors = [];
  const applications = { ...defaultBotControl.staffApplications, ...(template.botControl?.staffApplications ?? {}) };
  const privateAccessRoleNames = [...new Set([
    'Founder', 'Administrator', 'Moderator', 'Support Team',
    applications.reviewRole, applications.approvedRole,
    ...(template.categories.flatMap(group => group.allowed_roles ?? [])),
    ...(template.__templateMeta?.permissions?.staff_category?.allowed_roles ?? [])
  ].filter(name => typeof name === 'string' && name.trim()).map(name => name.trim().toLowerCase()))];

  // Create lower-ranked roles first so roles listed earlier in the JSON remain higher in the new hierarchy.
  for (const definition of [...template.roles].reverse()) {
    try {
      let role = guild.roles.cache.find(item => item.name.toLowerCase() === definition.name.trim().toLowerCase());
      if (!role) {
        role = await guild.roles.create({
          name: definition.name.trim(),
          color: definition.color ?? 0xD7DCE4,
          ...(definition.hoist !== undefined ? { hoist: definition.hoist === true } : {}),
          ...(definition.permissions !== undefined ? { permissions: definition.permissions } : {}),
          reason: 'Published Meta Code server template'
        });
        created.push('role ' + role.name);
      } else if (role.name !== definition.name.trim() || (definition.color !== undefined && role.color !== definition.color) ||
          (definition.hoist !== undefined && role.hoist !== (definition.hoist === true)) ||
          (definition.permissions !== undefined && role.permissions.bitfield !== definition.permissions)) {
        await role.edit({
          name: definition.name.trim(),
          ...(definition.color !== undefined ? { color: definition.color } : {}),
          ...(definition.hoist !== undefined ? { hoist: definition.hoist === true } : {}),
          ...(definition.permissions !== undefined ? { permissions: definition.permissions } : {}),
          reason: 'Published Meta Code server template'
        });
        updated.push('role ' + definition.name.trim());
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
      let category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name.toLowerCase() === group.name.trim().toLowerCase());
      if (!category) {
        category = await guild.channels.create({ name: group.name.trim(), type: ChannelType.GuildCategory, reason: 'Published Meta Code server template' });
        created.push('category ' + category.name);
      } else if (category.name !== group.name.trim()) {
        await category.setName(group.name.trim(), 'Published Meta Code server template');
        updated.push('renamed category ' + group.name.trim());
      }

      desiredCategoryIds.add(category.id);
      const metaPermissions = template.__templateMeta?.permissions ?? {};
      const everyonePolicy = metaPermissions.everyone ?? {};
      const mutedPolicy = metaPermissions.muted_role ?? {};
      const mutedRole = template.roles.some(role => role.name.toLowerCase() === 'muted')
        ? guild.roles.cache.find(role => role.name.toLowerCase() === 'muted')
        : null;
      const allowedNames = group.allowed_roles ?? metaPermissions.staff_category?.allowed_roles ?? privateAccessRoleNames;
      const allowEverywhere = (everyonePolicy.allow ?? []).filter(name => CHANNEL_OVERWRITE_FLAGS.has(name)).map(name => PermissionFlagsBits[name]);
      const denyEverywhere = (everyonePolicy.deny ?? []).filter(name => CHANNEL_OVERWRITE_FLAGS.has(name)).map(name => PermissionFlagsBits[name]);
      const everyoneDeny = [...new Set([
        ...denyEverywhere,
        ...(group.private ? [PermissionFlagsBits.ViewChannel] : [])
      ])];
      const deniedSet = new Set(everyoneDeny.map(String));
      const effectiveEveryoneAllow = allowEverywhere.filter(permission => !deniedSet.has(String(permission)));
      const overwrites = [
        { id: guild.roles.everyone.id, ...(effectiveEveryoneAllow.length ? { allow: effectiveEveryoneAllow } : {}), ...(everyoneDeny.length ? { deny: everyoneDeny } : {}) },
        ...(group.private
          ? allowedNames.map(name => guild.roles.cache.find(role => role.name.toLowerCase() === String(name).trim().toLowerCase()))
            .filter(Boolean)
            .map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }))
          : []),
        ...(mutedRole && mutedPolicy.deny?.length ? [{
          id: mutedRole.id,
          deny: mutedPolicy.deny.filter(name => CHANNEL_OVERWRITE_FLAGS.has(name)).map(name => PermissionFlagsBits[name])
        }] : []),
        { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }
      ];
      await category.permissionOverwrites.set(overwrites, 'Published Meta Code server template');
      updated.push('category permissions ' + category.name);

      for (const [kind, rawName, channelOptions] of group.channels) {
        const name = normalizeChannelName(rawName);
        const allowedTypes = supportedTypesForKind(kind);
        const type = kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
        let channel = guild.channels.cache.find(item => !desiredChannelIds.has(item.id) && allowedTypes.includes(item.type) && item.name === name);
        if (!channel) {
          channel = await guild.channels.create({ name, type, parent: category.id, reason: 'Published Meta Code server template' });
          created.push('channel ' + name);
        } else {
          if (channel.parentId !== category.id) {
            await channel.setParent(category.id, { lockPermissions: true, reason: 'Published Meta Code server template' });
            updated.push('moved channel ' + name);
          } else {
            // Match the category's permission overwrites exactly.
            await channel.lockPermissions();
            skipped.push('channel ' + name);
          }
        }
        const readOnlySettings = metaPermissions.read_only_channels ?? {};
        const readOnlyNames = readOnlySettings.channels ?? [];
        const readOnly = channelOptions?.read_only === true || readOnlyNames.some(value => normalizeChannelName(value) === name);
        if (readOnly && channel.type !== ChannelType.GuildVoice) {
          const denyNames = Array.isArray(readOnlySettings.deny) ? readOnlySettings.deny : ['SendMessages'];
          const allowNames = Array.isArray(readOnlySettings.allow) ? readOnlySettings.allow : ['ViewChannel', 'ReadMessageHistory'];
          const denySet = new Set(denyNames);
          const channelPolicy = {};
          for (const permission of allowNames) {
            if (CHANNEL_OVERWRITE_FLAGS.has(permission) && !denySet.has(permission)) channelPolicy[permission] = true;
          }
          for (const permission of denyNames) {
            if (CHANNEL_OVERWRITE_FLAGS.has(permission)) channelPolicy[permission] = false;
          }
          await channel.permissionOverwrites.edit(guild.roles.everyone, channelPolicy, 'Read-only channel from Meta Code template');
          updated.push('read-only permissions ' + name);
        }
        desiredChannelIds.add(channel.id);
      }
    } catch (error) {
      errors.push('Category ' + group.name + ': ' + error.message);
    }
  }

  // Apply the requested server name before destructive cleanup. If Discord rejects
  // the rename, the safety gate below prevents channel/category/role deletions.
  if (!errors.length && plan.serverNameChange) {
    try {
      await guild.setName(plan.serverNameChange.desired, 'Applied server name from Meta Code setup template');
      updated.push('server name ' + plan.serverNameChange.desired);
    } catch (error) {
      errors.push('Server name: ' + error.message);
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
  const desiredBotName = String(template.__templateMeta?.branding?.botName || '').trim();
  if (desiredBotName && desiredBotName.length <= 32 && desiredBotName !== botMember.nickname) {
    try {
      if (botMember.permissions.has(PermissionFlagsBits.ChangeNickname) ||
          botMember.permissions.has(PermissionFlagsBits.ManageNicknames) ||
          botMember.permissions.has(PermissionFlagsBits.Administrator)) {
        await botMember.setNickname(desiredBotName, 'Applied Meta Code template bot branding');
        updated.push('bot server nickname ' + desiredBotName);
      } else {
        skipped.push('bot nickname (Meta lacks Change Nickname permission)');
      }
    } catch (error) {
      skipped.push('bot nickname: ' + error.message);
    }
  }
  const ticketSettings = template.__templateMeta?.botSettings?.ticket;
  const ticketPanelName = ticketSettings?.panel_channel || template.categories.flatMap(group => group.channels).find(([, , options]) => options?.bot_panel === 'tickets')?.[1];
  if (ticketSettings?.enabled !== false && ticketPanelName) {
    const ticketPanelChannel = findChannelByName(guild, ticketPanelName, [ChannelType.GuildText, ChannelType.GuildAnnouncement]);
    if (ticketPanelChannel) {
      try { await publishTicketPanel(guild, ticketPanelChannel.id); }
      catch (error) { errors.push('Ticket panel: ' + error.message); }
    } else {
      errors.push('Ticket panel: configured panel channel was not found.');
    }
  }
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
      (plan.serverNameChange ? 'Rename server: ' + plan.serverNameChange.current + ' → ' + plan.serverNameChange.desired + '\n' : 'Server name: unchanged\n') +
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

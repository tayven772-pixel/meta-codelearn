import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
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

const AUTO_MOD_TRIGGER_TYPES = {
  keyword: AutoModerationRuleTriggerType.Keyword,
  spam: AutoModerationRuleTriggerType.Spam,
  keywordPreset: AutoModerationRuleTriggerType.KeywordPreset,
  mentionSpam: AutoModerationRuleTriggerType.MentionSpam,
  memberProfile: AutoModerationRuleTriggerType.MemberProfile
};
const AUTO_MOD_PRESETS = { profanity: 1, sexualContent: 2, slurs: 3 };
const AUTO_MOD_SETTING_KEYS = new Set([
  'autopartner_enabled','autopartner_channel_id','autopartner_interval_hours','autopartner_min_members','autopartner_template',
  'server_setup_template','bot_welcome_message','bot_rules_text','bot_status_text',
  'community_welcome_channel_id','community_welcome_message','community_welcome_avatar','community_autorole_id','community_log_channel_id','community_xp_enabled',
  'link_protection_enabled','link_protection_owner_id','server_profile_guard_enabled','softban_channel_id',
  'staff_applications_enabled','staff_applications_channel_id','staff_applications_title','staff_applications_description','staff_applications_role_id',
  'ticket_panel_style','ticket_categories','ticket_form_questions','ticket_panel_title','ticket_panel_description','ticket_category_id','ticket_staff_role_id','ticket_log_channel_id','ticket_close_delay_seconds',
  'community_rules_config','community_rules_message_channel','community_rules_message_id',
  ...['meta','lessons','ping','help'].map(name => 'bot_response:' + name)
]);
const AUTO_MOD_COMMANDS = [
  'meta','lessons','ping','membercount','avatar','roleinfo','slowmode','lock','unlock','embed','help',
  'serverinfo','userinfo','poll','suggest','coinflip','roll','choose','8ball','announce',
  'setup-applications','ticket','ticket-panel','setup-server','warn','warnings','timeout','untimeout','purge',
  'autopartner-setup','partner-add','partner-remove','partner-list','partner-settings','partner-template','partner-post',
  'welcome-config','autorole','logging','level','leaderboard','giveaway','giveaway-end','role-menu','serverstats','config-export',
  'thread','topic','randomcolor','remindme'
];
function isAllowedBotSettingKey(key) {
  return AUTO_MOD_SETTING_KEYS.has(key) ||
    AUTO_MOD_COMMANDS.some(name => key === 'bot_command_enabled:' + name) ||
    /^staff_application_(?:question|min_words)_[1-5]$/.test(key);
}
function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function validateAutoModerationConfig(config) {
  if (!isPlainObject(config) || (config.enabled !== undefined && typeof config.enabled !== 'boolean') ||
      (config.syncUnlisted !== undefined && typeof config.syncUnlisted !== 'boolean') ||
      !Array.isArray(config.rules) || config.rules.length > 10) {
    throw new Error('automod must contain enabled (optional), syncUnlisted (optional), and up to 10 rules.');
  }
  const names = new Set();
  const triggerCounts = {};
  for (const [index, rule] of config.rules.entries()) {
    if (!isPlainObject(rule) || typeof rule.name !== 'string' || !rule.name.trim() || rule.name.length > 100 ||
        !Object.hasOwn(AUTO_MOD_TRIGGER_TYPES, rule.trigger) ||
        (rule.eventType !== undefined && !['messageSend','memberUpdate'].includes(rule.eventType)) ||
        (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') ||
        (rule.keywords !== undefined && (!Array.isArray(rule.keywords) || rule.keywords.length > 1000 || rule.keywords.some(item => typeof item !== 'string' || !item.trim() || item.length > 60))) ||
        (rule.regexPatterns !== undefined && (!Array.isArray(rule.regexPatterns) || rule.regexPatterns.length > 10 || rule.regexPatterns.some(item => typeof item !== 'string' || !item.trim() || item.length > 260))) ||
        (rule.allowList !== undefined && (!Array.isArray(rule.allowList) || rule.allowList.length > 100 || rule.allowList.some(item => typeof item !== 'string' || !item.trim() || item.length > 60))) ||
        (rule.presets !== undefined && (!Array.isArray(rule.presets) || rule.presets.some(item => !Object.hasOwn(AUTO_MOD_PRESETS, item)))) ||
        (rule.mentionTotalLimit !== undefined && (!Number.isInteger(rule.mentionTotalLimit) || rule.mentionTotalLimit < 1 || rule.mentionTotalLimit > 50)) ||
        (rule.exemptRoles !== undefined && (!Array.isArray(rule.exemptRoles) || rule.exemptRoles.length > 20 || rule.exemptRoles.some(item => typeof item !== 'string' || !item.trim() || item.length > 100))) ||
        (rule.exemptChannels !== undefined && (!Array.isArray(rule.exemptChannels) || rule.exemptChannels.length > 50 || rule.exemptChannels.some(item => typeof item !== 'string' || !item.trim() || item.length > 100))) ||
        !Array.isArray(rule.actions) || rule.actions.length < 1 || rule.actions.length > 5) {
      throw new Error('Invalid AutoMod rule #' + (index + 1) + '. Check its name, trigger, filters, exemptions, and actions.');
    }
    const key = rule.name.trim().toLowerCase();
    if (names.has(key)) throw new Error('AutoMod rule names must be unique.');
    names.add(key);
    for (const [actionIndex, action] of rule.actions.entries()) {
      if (!isPlainObject(action) || !['blockMessage','sendAlert','timeout','blockMemberInteraction'].includes(action.type)) {
        throw new Error('Invalid action in AutoMod rule ' + rule.name + '. Use blockMessage, sendAlert, timeout, or blockMemberInteraction.');
      }
      if (action.type === 'blockMessage' && action.message !== undefined &&
          (typeof action.message !== 'string' || action.message.length > 150)) {
        throw new Error('AutoMod blockMessage text must be 150 characters or fewer.');
      }
      if (action.type === 'sendAlert' && (typeof action.channel !== 'string' || !action.channel.trim() || action.channel.length > 100)) {
        throw new Error('AutoMod sendAlert actions must specify a text channel name or ID.');
      }
      if (action.type === 'timeout' &&
          (!Number.isInteger(action.durationSeconds) || action.durationSeconds < 60 || action.durationSeconds > 2419200)) {
        throw new Error('AutoMod timeout durationSeconds must be between 60 and 2,419,200.');
      }
    }
    if (['keyword','memberProfile'].includes(rule.trigger) && !(rule.keywords?.length || rule.regexPatterns?.length)) {
      throw new Error(rule.trigger + ' AutoMod rules need at least one keywords or regexPatterns entry.');
    }
    if (rule.trigger === 'memberProfile' && rule.eventType !== undefined && rule.eventType !== 'memberUpdate') {
      throw new Error('memberProfile AutoMod rules must use eventType "memberUpdate".');
    }
    if (rule.trigger !== 'memberProfile' && rule.eventType === 'memberUpdate') {
      throw new Error('Only memberProfile AutoMod rules can use eventType "memberUpdate".');
    }
    if (rule.trigger === 'keywordPreset' && !rule.presets?.length) {
      throw new Error('keywordPreset AutoMod rules need at least one preset: profanity, sexualContent, or slurs.');
    }
    if (rule.trigger === 'mentionSpam' && rule.mentionTotalLimit === undefined) {
      throw new Error('mentionSpam AutoMod rules need mentionTotalLimit (1–50).');
    }
    if (!['keyword','memberProfile'].includes(rule.trigger) && (rule.keywords?.length || rule.regexPatterns?.length || rule.allowList?.length)) {
      throw new Error('keywords, regexPatterns, and allowList are only supported by keyword or memberProfile AutoMod rules.');
    }
    if (rule.trigger !== 'keywordPreset' && rule.presets?.length) {
      throw new Error('presets are only supported by keywordPreset AutoMod rules.');
    }
    if (rule.trigger !== 'mentionSpam' && rule.mentionTotalLimit !== undefined) {
      throw new Error('mentionTotalLimit is only supported by mentionSpam AutoMod rules.');
    }
  }
}

export function validateServerTemplate(template) {
  if (!template || !Array.isArray(template.roles) || !Array.isArray(template.categories)) {
    throw new Error('Template must contain roles and categories arrays.');
  }
  const validRolePermissions = new Set(Object.keys(PermissionFlagsBits));
  if (template.branding !== undefined && (!template.branding || typeof template.branding !== 'object' ||
      Array.isArray(template.branding) || (template.branding.server_name !== undefined &&
        (typeof template.branding.server_name !== 'string' || !template.branding.server_name.trim() ||
          template.branding.server_name.trim().length > 100)))) {
    throw new Error('branding.server_name must be a non-empty Discord server name of 100 characters or fewer.');
  }
  if (template.roles.length > 40 || template.categories.length > 30 ||
      template.roles.some(role => !role || typeof role.name !== 'string' || !role.name.trim() || role.name.length > 100 ||
        (role.color !== undefined && (!Number.isInteger(role.color) || role.color < 0 || role.color > 0xFFFFFF)) ||
        (role.hoist !== undefined && typeof role.hoist !== 'boolean') ||
        (role.mentionable !== undefined && typeof role.mentionable !== 'boolean') ||
        (role.permissions !== undefined && (!Array.isArray(role.permissions) ||
          role.permissions.some(permission => typeof permission !== 'string' || !validRolePermissions.has(permission))))) ||
      template.categories.some(group => !group || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 100 ||
        !Array.isArray(group.channels) || group.channels.length > 50 || (group.private !== undefined && typeof group.private !== 'boolean') ||
        group.channels.some(channel => {
          if (!Array.isArray(channel) || !['text','voice'].includes(channel[0]) ||
              typeof channel[1] !== 'string' || !channel[1].trim() || channel[1].length > 100) return true;
          const options = channel[2] ?? {};
          if (!isPlainObject(options) || Object.keys(options).some(key => !['topic','nsfw','slowmode','bitrate','userLimit'].includes(key))) return true;
          if (options.topic !== undefined && (typeof options.topic !== 'string' || options.topic.length > 1024)) return true;
          if (options.nsfw !== undefined && typeof options.nsfw !== 'boolean') return true;
          if (options.slowmode !== undefined && (channel[0] !== 'text' || !Number.isInteger(options.slowmode) || options.slowmode < 0 || options.slowmode > 21600)) return true;
          if (options.bitrate !== undefined && (channel[0] !== 'voice' || !Number.isInteger(options.bitrate) || options.bitrate < 8000 || options.bitrate > 96000)) return true;
          if (options.userLimit !== undefined && (channel[0] !== 'voice' || !Number.isInteger(options.userLimit) || options.userLimit < 0 || options.userLimit > 99)) return true;
          if (channel[0] === 'voice' && options.topic !== undefined) return true;
          return false;
        }))) {
    throw new Error('Invalid template structure. Check role options, channel types, and channel topic/nsfw/slowmode/bitrate/userLimit values.');
  }
  const totalChannels = template.categories.reduce((total, group) => total + group.channels.length, 0);
  if (totalChannels + template.categories.length > 450) throw new Error('The template exceeds the conservative 450-channel/category safety limit.');
  const roleNames = template.roles.map(role => role.name.trim().toLowerCase());
  if (roleNames.includes('@everyone')) throw new Error('The @everyone role is managed by Discord and cannot be included in roles.');
  if (new Set(roleNames).size !== roleNames.length) throw new Error('Role names must be unique.');
  const categoryNames = template.categories.map(group => group.name.trim().toLowerCase());
  if (new Set(categoryNames).size !== categoryNames.length) throw new Error('Category names must be unique.');
  const channelKeys = [];
  for (const group of template.categories) for (const [kind, rawName] of group.channels) {
    channelKeys.push(normalizeChannelName(rawName));
  }
  if (new Set(channelKeys).size !== channelKeys.length) throw new Error('Channel names must be unique for each channel type after normalization.');
  const channelPermissions = template.channelPermissions;
  if (channelPermissions !== undefined && (!Array.isArray(channelPermissions) || channelPermissions.length > 500 ||
      channelPermissions.some(rule => !rule || typeof rule !== 'object' || Array.isArray(rule) ||
        typeof rule.channel !== 'string' || !rule.channel.trim() || rule.channel.length > 100 ||
        typeof rule.role !== 'string' || !rule.role.trim() || rule.role.length > 100 ||
        (rule.sendMessages !== undefined && !['allow','deny','inherit'].includes(rule.sendMessages)) ||
        (rule.allow !== undefined && (!Array.isArray(rule.allow) || rule.allow.some(permission => typeof permission !== 'string' || !validRolePermissions.has(permission)))) ||
        (rule.deny !== undefined && (!Array.isArray(rule.deny) || rule.deny.some(permission => typeof permission !== 'string' || !validRolePermissions.has(permission)))) ||
        (rule.allow !== undefined && rule.deny !== undefined && rule.allow.some(permission => rule.deny.includes(permission)))))) {
    throw new Error('channelPermissions must contain channel/role references and optional allow/deny arrays of valid Discord permission names.');
  }
  const channelNamesForPermissions = new Set(template.categories.flatMap(group => group.channels.map(channel => normalizeChannelName(channel[1]))));
  const roleNamesForPermissions = new Set(template.roles.map(role => role.name.trim().toLowerCase()));
  for (const rule of channelPermissions || []) {
    if (!channelNamesForPermissions.has(normalizeChannelName(rule.channel))) throw new Error('channelPermissions.channel must reference a channel in categories.');
    if (!roleNamesForPermissions.has(rule.role.trim().toLowerCase())) throw new Error('channelPermissions.role must reference a role in roles.');
  }
  const permissionKeys = (channelPermissions || []).map(rule => normalizeChannelName(rule.channel) + '|' + rule.role.trim().toLowerCase());
  if (new Set(permissionKeys).size !== permissionKeys.length) throw new Error('Only one channelPermissions rule per channel/role pair is allowed.');

  const panel = template.controlPanel;
  if (panel !== undefined && (!panel || typeof panel !== 'object' || Array.isArray(panel) ||
      (panel.title !== undefined && (typeof panel.title !== 'string' || panel.title.length > 80)) ||
      (panel.description !== undefined && (typeof panel.description !== 'string' || panel.description.length > 240)) ||
      (panel.sections !== undefined && (!Array.isArray(panel.sections) ||
        panel.sections.some(section => !['setup','commands','responses','tickets','messages','community','autopartner','applications'].includes(section)))))) {
    throw new Error('controlPanel must use a title, description, and known sections only.');
  }
  const settings = template.settings;
  if (settings !== undefined && (!settings || typeof settings !== 'object' || Array.isArray(settings))) {
    throw new Error('settings must be a JSON object.');
  }
  for (const [key, block] of Object.entries(settings || {})) {
    if (!['welcome','autopartner','applications','tickets','automod'].includes(key) || !block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error('Unsupported settings block: ' + key);
    }
  }
  if (template.automod !== undefined && settings?.automod !== undefined) {
    throw new Error('Configure AutoMod in only one place: use the top-level automod property.');
  }
  const automod = template.automod ?? settings?.automod;
  if (automod !== undefined) validateAutoModerationConfig(automod);
  if (template.botSettings !== undefined) {
    if (!isPlainObject(template.botSettings) || Object.entries(template.botSettings).some(([key, value]) =>
      !isAllowedBotSettingKey(key) || !['string','number','boolean'].includes(typeof value) ||
      String(value).length > (key === 'server_setup_template' ? 30000 : 5000))) {
      throw new Error('botSettings contains an unsupported key or invalid value. Export a fresh backup or use known Meta Bot Control setting keys.');
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
      (applications.panelDescription !== undefined && (typeof applications.panelDescription !== 'string' || applications.panelDescription.length > 1000)) ||
      (applications.staffRole !== undefined && (typeof applications.staffRole !== 'string' || applications.staffRole.length > 100)))) {
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
  if ([...categoryNamesForSettings].some(name => channelKeys.includes(name))) {
    throw new Error('Category names must not also be used as channel names.');
  }
  const roleNamesForSettings = new Set(template.roles.map(role => role.name.trim().toLowerCase()));
  const staffRole = settings?.applications?.staffRole;
  if (staffRole && !roleNamesForSettings.has(staffRole.trim().toLowerCase())) throw new Error('settings.applications.staffRole must reference a role name in roles.');
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

function resolveAutoModChannel(guild, reference) {
  const value = String(reference || '').trim();
  return /^\\d{17,20}$/.test(value)
    ? guild.channels.cache.get(value) || null
    : guild.channels.cache.find(channel => channel.name.toLowerCase() === normalizeChannelName(value)) || null;
}
function resolveAutoModRole(guild, reference) {
  const value = String(reference || '').trim();
  return /^\\d{17,20}$/.test(value)
    ? guild.roles.cache.get(value) || null
    : guild.roles.cache.find(role => role.name.toLowerCase() === value.toLowerCase()) || null;
}
async function buildAutoModerationPlan(guild, config) {
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('AutoMod JSON needs the bot to have Manage Server (Manage Guild) permission.');
  }
  if (config.rules.some(rule => rule.actions.some(action => action.type === 'timeout')) &&
      !botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    throw new Error('AutoMod timeout actions need the bot to have Moderate Members permission.');
  }
  if (!guild.autoModerationRules?.fetch) throw new Error('This Discord server or bot library does not support AutoMod rule management.');
  const existing = await guild.autoModerationRules.fetch();
  const wanted = new Map(config.rules.map(rule => [rule.name.trim().toLowerCase(), rule]));
  const create = [], update = [], remove = [];
  for (const rule of config.rules) {
    const current = existing.find(item => item.name.toLowerCase() === rule.name.trim().toLowerCase());
    const entry = { name: rule.name, enabled: config.enabled !== false && rule.enabled !== false, trigger: rule.trigger };
    if (!current) {
      if (config.enabled !== false && rule.enabled !== false) create.push(entry);
    } else update.push({ id: current.id, ...entry });
  }
  if (config.syncUnlisted === true && config.enabled !== false) {
    for (const rule of existing.values()) {
      if (!wanted.has(rule.name.toLowerCase())) remove.push({ id: rule.id, name: rule.name });
    }
  }
  const resultingCount = existing.size + create.length - remove.length;
  if (resultingCount > 10) throw new Error('The requested AutoMod configuration would exceed Discord’s per-server rule limits.');
  return { enabled: config.enabled !== false, syncUnlisted: config.syncUnlisted === true, create, update, remove };
}
async function buildAutoModerationPayload(guild, rule, globallyEnabled = true) {
  const triggerType = AUTO_MOD_TRIGGER_TYPES[rule.trigger];
  const triggerMetadata = {};
  if (rule.keywords?.length) triggerMetadata.keywordFilter = rule.keywords;
  if (rule.regexPatterns?.length) triggerMetadata.regexPatterns = rule.regexPatterns;
  if (rule.allowList?.length) triggerMetadata.allowList = rule.allowList;
  if (rule.presets?.length) triggerMetadata.presets = [...new Set(rule.presets)].map(preset => AUTO_MOD_PRESETS[preset]);
  if (rule.mentionTotalLimit !== undefined) triggerMetadata.mentionTotalLimit = rule.mentionTotalLimit;

  const actions = [];
  for (const action of rule.actions) {
    if (action.type === 'blockMessage') {
      actions.push({ type: AutoModerationActionType.BlockMessage, ...(action.message ? { metadata: { customMessage: action.message } } : {}) });
    } else if (action.type === 'sendAlert') {
      const channel = resolveAutoModChannel(guild, action.channel);
      if (!channel || !channel.isTextBased?.() || channel.isDMBased?.()) {
        throw new Error('AutoMod alert channel "' + action.channel + '" was not found as a server text channel.');
      }
      actions.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel } });
    } else if (action.type === 'timeout') {
      actions.push({ type: AutoModerationActionType.Timeout, metadata: { durationSeconds: action.durationSeconds } });
    } else if (action.type === 'blockMemberInteraction') {
      actions.push({ type: AutoModerationActionType.BlockMemberInteraction });
    }
  }
  const exemptRoles = (rule.exemptRoles || []).map(name => {
    const role = resolveAutoModRole(guild, name);
    if (!role) throw new Error('AutoMod exempt role "' + name + '" could not be found.');
    return role;
  });
  const exemptChannels = (rule.exemptChannels || []).map(name => {
    const channel = resolveAutoModChannel(guild, name);
    if (!channel) throw new Error('AutoMod exempt channel "' + name + '" could not be found.');
    return channel;
  });
  return {
    name: rule.name.trim(),
    enabled: globallyEnabled && rule.enabled !== false,
    eventType: rule.eventType === 'memberUpdate' ? AutoModerationRuleEventType.MemberUpdate : AutoModerationRuleEventType.MessageSend,
    triggerType,
    triggerMetadata,
    actions,
    exemptRoles,
    exemptChannels
  };
}
async function applyAutoModerationConfig(guild, config) {
  const current = await guild.autoModerationRules.fetch();
  const results = { created: [], updated: [], deleted: [], disabled: [] };
  const desiredNames = new Set(config.rules.map(rule => rule.name.trim().toLowerCase()));
  for (const definition of config.rules) {
    const existing = current.find(rule => rule.name.toLowerCase() === definition.name.trim().toLowerCase());
    if (!existing && (config.enabled === false || definition.enabled === false)) continue;
    const payload = await buildAutoModerationPayload(guild, definition, config.enabled !== false);
    try {
      if (existing) {
        await guild.autoModerationRules.edit(existing.id, { ...payload, reason: 'Meta Code JSON AutoMod sync' });
        if (!payload.enabled) results.disabled.push(definition.name);
        else results.updated.push(definition.name);
      } else {
        await guild.autoModerationRules.create({ ...payload, reason: 'Meta Code JSON AutoMod sync' });
        results.created.push(definition.name);
      }
    } catch (error) {
      throw new Error('Could not apply AutoMod rule "' + definition.name + '": ' + error.message);
    }
  }
  if (config.syncUnlisted === true && config.enabled !== false) {
    for (const rule of current.values()) {
      if (desiredNames.has(rule.name.toLowerCase())) continue;
      try {
        await guild.autoModerationRules.delete(rule.id, 'Not present in confirmed Meta Code AutoMod JSON');
        results.deleted.push(rule.name);
      } catch (error) {
        throw new Error('Could not remove unlisted AutoMod rule "' + rule.name + '": ' + error.message);
      }
    }
  }
  return results;
}

function desiredChannelDefinitions(template) {
  const output = [];
  for (const group of template.categories) {
    for (const [kind, rawName, rawOptions] of group.channels) {
      output.push({
        name: normalizeChannelName(rawName),
        type: kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        categoryName: group.name.trim(),
        options: rawOptions || {}
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

  const botHighest = botMember.roles.highest.position;
  const desiredChannels = desiredChannelDefinitions(template);
  const usedRoleIds = new Set();
  const usedCategoryIds = new Set();
  const usedChannelIds = new Set();
  const createRoles = [], updateRoles = [], deleteRoles = [], protectedRoles = [];
  const createCategories = [], updateCategories = [], deleteCategories = [];
  const createChannels = [], moveChannels = [], updateChannels = [], syncChannelPermissions = [], deleteChannels = [], protectedChannels = [];
  const desiredServerName = template.branding?.server_name?.trim();
  const renameServer = desiredServerName && desiredServerName !== guild.name
    ? { current: guild.name, desired: desiredServerName } : null;

  for (const definition of template.roles) {
    const existing = guild.roles.cache.find(role => role.name.toLowerCase() === definition.name.trim().toLowerCase());
    const desiredPermissions = definition.permissions === undefined ? undefined : [...new Set(definition.permissions)].sort();
    if (!existing) createRoles.push({
      name: definition.name.trim(),
      color: definition.color ?? 0xD7DCE4,
      permissions: desiredPermissions ?? [],
      hoist: definition.hoist ?? false,
      mentionable: definition.mentionable ?? false
    });
    else {
      usedRoleIds.add(existing.id);
      const colorChanged = definition.color !== undefined && existing.color !== definition.color;
      const currentPermissions = existing.permissions.toArray().sort();
      const permissionsChanged = desiredPermissions !== undefined &&
        JSON.stringify(currentPermissions) !== JSON.stringify(desiredPermissions);
      const hoistChanged = definition.hoist !== undefined && existing.hoist !== definition.hoist;
      const mentionableChanged = definition.mentionable !== undefined && existing.mentionable !== definition.mentionable;
      if (colorChanged || permissionsChanged || hoistChanged || mentionableChanged) {
        if (existing.managed || existing.position >= botHighest) {
          protectedRoles.push({ id: existing.id, name: existing.name, reason: existing.managed ? 'managed by Discord/integration' : 'at or above Meta bot role' });
        } else {
          updateRoles.push({
            id: existing.id,
            name: existing.name,
            ...(colorChanged ? { color: definition.color } : {}),
            ...(permissionsChanged ? { permissions: desiredPermissions } : {}),
            ...(hoistChanged ? { hoist: definition.hoist } : {}),
            ...(mentionableChanged ? { mentionable: definition.mentionable } : {})
          });
        }
      }
    }
  }

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
      if (!existing.manageable) protectedChannels.push({ id: existing.id, name: existing.name, reason: 'category is not manageable by Meta bot' });
      else updateCategories.push({ id: existing.id, name: existing.name, private: Boolean(group.private) });
    }
  }

  for (const definition of desiredChannels) {
    const category = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === definition.categoryName.toLowerCase());
    const existing = guild.channels.cache.find(channel => channel.type === definition.type && channel.name.toLowerCase() === definition.name && !usedChannelIds.has(channel.id));
    if (existing) {
      usedChannelIds.add(existing.id);
      if (!existing.manageable) protectedChannels.push({ id: existing.id, name: existing.name, reason: 'channel is not manageable by Meta bot' });
      else {
        if (!category || existing.parentId !== category.id) moveChannels.push({ id: existing.id, name: existing.name, fromCategory: existing.parent?.name || 'No category', toCategory: definition.categoryName });
        else syncChannelPermissions.push({ id: existing.id, name: existing.name, categoryName: definition.categoryName });
        const options = definition.options || {};
        const changes = {};
        if (options.topic !== undefined && existing.topic !== options.topic) changes.topic = options.topic;
        if (options.nsfw !== undefined && existing.nsfw !== options.nsfw) changes.nsfw = options.nsfw;
        if (options.slowmode !== undefined && existing.rateLimitPerUser !== options.slowmode) changes.rateLimitPerUser = options.slowmode;
        if (options.bitrate !== undefined && existing.bitrate !== options.bitrate) changes.bitrate = options.bitrate;
        if (options.userLimit !== undefined && existing.userLimit !== options.userLimit) changes.userLimit = options.userLimit;
        if (Object.keys(changes).length) updateChannels.push({ id: existing.id, name: existing.name, changes });
      }
    } else {
      createChannels.push({ name: definition.name, type: definition.type, categoryName: definition.categoryName, options: definition.options || {} });
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

  const automodConfig = template.automod ?? template.settings?.automod;
  const autoModeration = automodConfig ? await buildAutoModerationPlan(guild, automodConfig) : null;
  const plan = { renameServer, createRoles, updateRoles, deleteRoles, protectedRoles, createCategories, updateCategories, deleteCategories, createChannels, moveChannels, updateChannels, syncChannelPermissions, deleteChannels, protectedChannels, channelPermissions: template.channelPermissions || [], autoModeration };
  const fingerprint = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return { fingerprint, plan };
}

async function applyTemplateSettings(guild, template) {
  setSetting('global', 'server_setup_template', JSON.stringify(template));
  const settings = template.settings || {};
  const findChannel = reference => resolveAutoModChannel(guild, reference);
  const findRole = reference => resolveAutoModRole(guild, reference);
  const write = (key, value) => setSetting('global', key, String(value));

  // Restore the exact dashboard values contained in an exported backup.
  // Structured settings below are applied afterward, so edits to the readable
  // JSON blocks take precedence over the corresponding legacy key/value fields.
  for (const [key, value] of Object.entries(template.botSettings || {})) {
    if (isAllowedBotSettingKey(key)) write(key, value);
  }

  const welcome = settings.welcome;
  if (welcome) {
    const channel = welcome.channel ? findChannel(welcome.channel) : null;
    if (welcome.enabled === false) write('community_welcome_channel_id', '');
    else if (channel) write('community_welcome_channel_id', channel.id);
    if (typeof welcome.message === 'string') write('community_welcome_message', welcome.message.slice(0, 1500));
    if (typeof welcome.showAvatar === 'boolean') write('community_welcome_avatar', welcome.showAvatar ? 'true' : 'false');
  }

  const partner = settings.autopartner;
  if (partner) {
    const channel = partner.channel ? findChannel(partner.channel) : null;
    if (channel) write('autopartner_channel_id', channel.id);
    if (typeof partner.enabled === 'boolean') write('autopartner_enabled', partner.enabled);
    if (Number.isInteger(partner.intervalHours)) write('autopartner_interval_hours', partner.intervalHours);
    if (Number.isInteger(partner.minimumMembers)) write('autopartner_min_members', partner.minimumMembers);
    if (typeof partner.template === 'string') write('autopartner_template', partner.template.slice(0, 1800));
  }

  const applications = settings.applications;
  if (applications) {
    const channel = applications.staffChannel ? findChannel(applications.staffChannel) : null;
    if (channel) write('staff_applications_channel_id', channel.id);
    const staffRole = applications.staffRole ? findRole(applications.staffRole) : null;
    if (staffRole) write('staff_applications_role_id', staffRole.id);
    if (typeof applications.enabled === 'boolean') write('staff_applications_enabled', applications.enabled);
    if (typeof applications.panelTitle === 'string') write('staff_applications_title', applications.panelTitle.slice(0, 45));
    if (typeof applications.panelDescription === 'string') write('staff_applications_description', applications.panelDescription.slice(0, 1000));
    if (Array.isArray(applications.questions)) {
      applications.questions.forEach((entry, index) => {
        const number = index + 1;
        const question = typeof entry === 'string' ? entry : entry?.question;
        const minimumWords = typeof entry === 'object' && entry ? entry.minimumWords : undefined;
        if (typeof question === 'string') write('staff_application_question_' + number, question.slice(0, 500));
        if (Number.isInteger(minimumWords)) write('staff_application_min_words_' + number, minimumWords);
      });
    }
  }

  const tickets = settings.tickets;
  if (tickets) {
    const category = tickets.category ? findChannel(tickets.category) : null;
    const staffRole = tickets.staffRole ? findRole(tickets.staffRole) : null;
    const logChannel = tickets.logChannel ? findChannel(tickets.logChannel) : null;
    if (category?.type === ChannelType.GuildCategory) write('ticket_category_id', category.id);
    if (staffRole) write('ticket_staff_role_id', staffRole.id);
    if (logChannel) write('ticket_log_channel_id', logChannel.id);
    if (typeof tickets.closeDelaySeconds === 'number') write('ticket_close_delay_seconds', tickets.closeDelaySeconds);
    if (typeof tickets.panelStyle === 'string') write('ticket_panel_style', tickets.panelStyle);
    if (Array.isArray(tickets.categories)) write('ticket_categories', JSON.stringify(tickets.categories));
    if (Array.isArray(tickets.formQuestions)) write('ticket_form_questions', JSON.stringify(tickets.formQuestions));
    if (typeof tickets.panelTitle === 'string') write('ticket_panel_title', tickets.panelTitle.slice(0, 256));
    if (typeof tickets.panelDescription === 'string') write('ticket_panel_description', tickets.panelDescription.slice(0, 4000));
  }

  const community = settings.community;
  if (community) {
    const role = community.autorole ? findRole(community.autorole) : null;
    const logChannel = community.logChannel ? findChannel(community.logChannel) : null;
    if (role) write('community_autorole_id', role.id);
    if (logChannel) write('community_log_channel_id', logChannel.id);
    if (typeof community.xpEnabled === 'boolean') write('community_xp_enabled', community.xpEnabled);
  }

  const security = settings.security;
  if (security) {
    if (typeof security.linkProtectionEnabled === 'boolean') write('link_protection_enabled', security.linkProtectionEnabled);
    if (typeof security.linkProtectionOwnerId === 'string') write('link_protection_owner_id', security.linkProtectionOwnerId);
    if (typeof security.serverProfileGuardEnabled === 'boolean') write('server_profile_guard_enabled', security.serverProfileGuardEnabled);
  }

  const moderation = settings.moderation;
  if (moderation?.softbanChannel) {
    const channel = findChannel(moderation.softbanChannel);
    if (channel) write('softban_channel_id', channel.id);
    else if (moderation.softbanChannel === false) write('softban_channel_id', '');
  }

  const commands = settings.commands;
  if (commands) {
    for (const [name, enabled] of Object.entries(commands)) {
      if (AUTO_MOD_COMMANDS.includes(name) && typeof enabled === 'boolean') write('bot_command_enabled:' + name, enabled);
    }
  }
  const responses = settings.responses;
  if (responses) {
    for (const name of ['meta','lessons','ping','help']) {
      if (typeof responses[name] === 'string') write('bot_response:' + name, responses[name].slice(0, 2000));
    }
  }
}

export async function applyServerTemplate(guild, template, options = {}) {
  const { deleteUnlisted = false, expectedFingerprint = null } = options;
  const { fingerprint, plan } = await buildServerTemplatePlan(guild, template, deleteUnlisted);
  if (expectedFingerprint && fingerprint !== expectedFingerprint) {
    throw new Error('The Discord server changed after preview. Run Publish JSON again to review the updated deletion list.');
  }
  const created = [], updated = [], deleted = [], skipped = [];
  const protectedIds = new Set(plan.protectedChannels.map(item => item.id));
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (plan.renameServer) {
    try {
      await guild.edit({ name: plan.renameServer.desired }, 'Meta Code JSON setup sync');
      updated.push('server name ' + plan.renameServer.desired);
    } catch (error) {
      throw new Error('Could not rename the Discord server: ' + error.message);
    }
  }
  for (const role of plan.createRoles) {
    try {
      const item = await guild.roles.create({
        name: role.name,
        color: role.color,
        permissions: role.permissions,
        hoist: role.hoist,
        mentionable: role.mentionable,
        reason: 'Meta Code JSON setup sync'
      });
      created.push('role ' + item.name);
    } catch (error) { throw new Error('Could not create role ' + role.name + ': ' + error.message); }
  }
  for (const role of plan.updateRoles) {
    try {
      const item = await guild.roles.fetch(role.id);
      if (item) {
        const changes = {};
        if (role.color !== undefined) changes.color = role.color;
        if (role.permissions !== undefined) changes.permissions = role.permissions;
        if (role.hoist !== undefined) changes.hoist = role.hoist;
        if (role.mentionable !== undefined) changes.mentionable = role.mentionable;
        await item.edit(changes, 'Meta Code JSON setup sync');
        updated.push('role ' + role.name);
      }
    } catch (error) { throw new Error('Could not update role ' + role.name + ': ' + error.message); }
  }
  await guild.roles.fetch();
  for (const definition of template.categories) {
    let category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name.toLowerCase() === definition.name.trim().toLowerCase());
    const staffRoleNames = new Set(['Founder','Administrator','Moderator','Support Team']);
    if (template.settings?.applications?.staffRole) staffRoleNames.add(template.settings.applications.staffRole);
    for (const roleId of [getSetting('global', 'staff_applications_role_id'), getSetting('global', 'ticket_staff_role_id')]) {
      const configuredRole = roleId ? guild.roles.cache.get(roleId) : null;
      if (configuredRole) staffRoleNames.add(configuredRole.name);
    }
    const overwrites = definition.private ? [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...[...staffRoleNames].map(name => guild.roles.cache.find(role => role.name.toLowerCase() === name.toLowerCase())).filter(Boolean)
        .map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
    ] : [];
    if (!category) {
      category = await guild.channels.create({ name: definition.name.trim(), type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: 'Meta Code JSON setup sync' });
      created.push('category ' + category.name);
    } else if (!protectedIds.has(category.id)) {
      await category.edit({ permissionOverwrites: overwrites, reason: 'Meta Code JSON setup sync' });
      updated.push('category permissions ' + category.name);
    }
  }
  await guild.channels.fetch();
  for (const definition of desiredChannelDefinitions(template)) {
    const category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name.toLowerCase() === definition.categoryName.toLowerCase());
    let channel = guild.channels.cache.find(item => item.type === definition.type && item.name.toLowerCase() === definition.name);
    if (channel && protectedIds.has(channel.id)) { skipped.push('protected channel ' + channel.name); continue; }
    if (category && protectedIds.has(category.id)) { skipped.push('channel ' + definition.name + ' in protected category ' + category.name); continue; }
    if (!channel) {
      channel = await guild.channels.create({
        name: definition.name, type: definition.type, parent: category?.id,
        ...(definition.options?.topic !== undefined ? { topic: definition.options.topic } : {}),
        ...(definition.options?.nsfw !== undefined ? { nsfw: definition.options.nsfw } : {}),
        ...(definition.options?.slowmode !== undefined ? { rateLimitPerUser: definition.options.slowmode } : {}),
        ...(definition.options?.bitrate !== undefined ? { bitrate: definition.options.bitrate } : {}),
        ...(definition.options?.userLimit !== undefined ? { userLimit: definition.options.userLimit } : {}),
        reason: 'Meta Code JSON setup sync'
      });
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
  for (const update of plan.updateChannels) {
    const channel = await guild.channels.fetch(update.id).catch(() => null);
    if (!channel || !channel.manageable) { skipped.push('channel details ' + update.name + ' (not manageable)'); continue; }
    try {
      await channel.edit({ ...update.changes, reason: 'Meta Code JSON channel settings sync' });
      updated.push('channel settings ' + update.name);
    } catch (error) {
      throw new Error('Could not update channel settings for ' + update.name + ': ' + error.message);
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
  // Apply explicit role-level channel permissions after channels and roles exist.
  for (const rule of template.channelPermissions || []) {
    const channel = /^\\d{17,20}$/.test(rule.channel)
      ? guild.channels.cache.get(rule.channel)
      : guild.channels.cache.find(item => item.name.toLowerCase() === normalizeChannelName(rule.channel));
    const role = guild.roles.cache.find(item => item.name.toLowerCase() === rule.role.trim().toLowerCase());
    if (!channel || !role) { skipped.push('channel permission rule ' + rule.channel + ' / ' + rule.role + ' (missing target)'); continue; }
    try {
      const overwrite = channel.permissionOverwrites.cache.get(role.id);
      const permissionChanges = {};
      for (const permission of rule.allow || []) permissionChanges[permission] = true;
      for (const permission of rule.deny || []) permissionChanges[permission] = false;
      if (rule.sendMessages !== undefined && !Object.hasOwn(permissionChanges, 'SendMessages')) {
        permissionChanges.SendMessages = rule.sendMessages === 'allow' ? true : rule.sendMessages === 'deny' ? false : null;
      }
      if (rule.sendMessages === 'inherit' && !Object.keys(permissionChanges).length) {
        if (overwrite) await channel.permissionOverwrites.delete(role.id, 'Meta Code JSON channel permission sync');
      } else if (Object.keys(permissionChanges).length) {
        await channel.permissionOverwrites.edit(role.id, permissionChanges, { reason: 'Meta Code JSON channel permission sync' });
      }
      updated.push('channel permissions for role ' + role.name + ' in #' + channel.name);
    } catch (error) {
      throw new Error('Could not set send-message permission for ' + rule.role + ' in ' + rule.channel + ': ' + error.message);
    }
  }
  const automodConfig = template.automod ?? template.settings?.automod;
  const automod = automodConfig ? await applyAutoModerationConfig(guild, automodConfig) : null;
  if (automod) {
    created.push(...automod.created.map(name => 'AutoMod rule ' + name));
    updated.push(...automod.updated.map(name => 'AutoMod rule ' + name));
    deleted.push(...automod.deleted.map(name => 'AutoMod rule ' + name));
    skipped.push(...automod.disabled.map(name => 'disabled AutoMod rule ' + name));
  }
  await applyTemplateSettings(guild, template);
  return { created, updated, deleted, skipped, errors: [], automod, protectedRoles: plan.protectedRoles, protectedChannels: plan.protectedChannels };
}

export async function previewServerTemplate(guild, template) {
  const { fingerprint, plan } = await buildServerTemplatePlan(guild, template, true);
  return {
    fingerprint,
    summary: {
      renameServer: plan.renameServer,
      createRoles: plan.createRoles,
      updateRoles: plan.updateRoles,
      deleteRoles: plan.deleteRoles,
      protectedRoles: plan.protectedRoles,
      createCategories: plan.createCategories,
      updateCategories: plan.updateCategories,
      deleteCategories: plan.deleteCategories,
      createChannels: plan.createChannels,
      moveChannels: plan.moveChannels,
      updateChannels: plan.updateChannels,
      deleteChannels: plan.deleteChannels,
      syncChannelPermissions: plan.syncChannelPermissions,
      channelPermissions: plan.channelPermissions,
      autoModeration: plan.autoModeration,
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

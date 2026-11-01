import { ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { db, getSetting, setSetting } from './database.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS autopartner_partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE,
    invite_url TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by TEXT NOT NULL,
    member_count INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (guild_id, name)
  );
  CREATE INDEX IF NOT EXISTS autopartner_guild_active ON autopartner_partners (guild_id, id);
`);

try { db.exec('ALTER TABLE autopartner_partners ADD COLUMN member_count INTEGER'); } catch (error) { if (!String(error.message).includes('duplicate column name')) throw error; }

const admin = PermissionFlagsBits.Administrator;
const channelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export const autoPartnerCommands = [
  new SlashCommandBuilder().setName('autopartner-setup').setDescription('Configure automatic partner posts')
    .setDefaultMemberPermissions(admin)
    .addChannelOption(o => o.setName('channel').setDescription('Where partner adverts are posted').addChannelTypes(...channelTypes).setRequired(true))
    .addIntegerOption(o => o.setName('interval_hours').setDescription('Hours between posts (6–168)').setMinValue(6).setMaxValue(168).setRequired(true))
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable automatic posting').setRequired(true))
    .addIntegerOption(o => o.setName('minimum_members').setDescription('Minimum Discord server members required for a partner post (default 100)').setMinValue(10).setMaxValue(1000000).setRequired(false)),
  new SlashCommandBuilder().setName('partner-add').setDescription('Submit a Discord server for automatic member-count verification')
    .addStringOption(o => o.setName('name').setDescription('Unique partner name').setMaxLength(60).setRequired(true))
    .addStringOption(o => o.setName('invite').setDescription('Discord invite URL').setMaxLength(200).setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Partner community description').setMaxLength(700).setRequired(true)),
  new SlashCommandBuilder().setName('partner-remove').setDescription('Remove a partner from rotation')
    .setDefaultMemberPermissions(admin)
    .addStringOption(o => o.setName('name').setDescription('Exact partner name').setMaxLength(60).setRequired(true)),
  new SlashCommandBuilder().setName('partner-list').setDescription('List approved partner servers'),
  new SlashCommandBuilder().setName('partner-settings').setDescription('View autopartner settings'),
  new SlashCommandBuilder().setName('partner-template').setDescription('Edit the partner advert template')
    .setDefaultMemberPermissions(admin)
    .addStringOption(o => o.setName('template').setDescription('Template with {name}, {invite}, {description}').setMaxLength(1500).setRequired(true)),
  new SlashCommandBuilder().setName('partner-post').setDescription('Post a partner advert now')
    .setDefaultMemberPermissions(admin)
    .addStringOption(o => o.setName('name').setDescription('Partner name (optional; next in rotation if omitted)').setMaxLength(60).setRequired(false)),
].map(command => command.toJSON());

const defaultTemplate = () => '**Partner spotlight: {name}**\n{description}\n\nJoin their community: {invite}\n\nShared through our approved partner network.';

function isAdmin(interaction) {
  return interaction.inGuild() && interaction.memberPermissions?.has(admin);
}

function getPartners(guildId) {
  return db.prepare('SELECT id, name, invite_url, description FROM autopartner_partners WHERE guild_id = ? ORDER BY id').all(guildId);
}

function renderEmbed(partner, guildId) {
  const template = getSetting(guildId, 'autopartner_template') || defaultTemplate();
  const description = template.replaceAll('{name}', partner.name).replaceAll('{invite}', partner.invite_url).replaceAll('{description}', partner.description);
  const embed = new EmbedBuilder().setColor(0x42B883).setTitle('🤝 Community Partner')
    .setDescription(description.slice(0, 4000)).setFooter({ text: 'Meta Code • Community partnerships' }).setTimestamp();
  if (Number.isFinite(Number(partner.member_count))) embed.addFields({ name: 'Approximate members', value: Number(partner.member_count).toLocaleString(), inline: true });
  return embed;
}

async function postPartner(client, guildId, partner) {
  const channelId = getSetting(guildId, 'autopartner_channel_id');
  if (!channelId) throw new Error('No partner channel configured. Run /autopartner-setup first.');
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.send) throw new Error('The configured partner channel is unavailable. Run /autopartner-setup again.');
  const message = await channel.send({ embeds: [renderEmbed(partner, guildId)], allowedMentions: { parse: [] } });
  setSetting(guildId, 'autopartner_last_posted_at', String(Date.now()));
  setSetting(guildId, 'autopartner_last_partner_id', String(partner.id));
  return message;
}

export async function handleAutoPartnerCommand(interaction) {
  const name = interaction.commandName;
  if (!name.startsWith('partner-') && name !== 'autopartner-setup') return false;
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Use partnership commands inside a server.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (['autopartner-setup', 'partner-remove', 'partner-template', 'partner-post'].includes(name) && !isAdmin(interaction)) {
    await interaction.reply({ content: 'Only server administrators can change partnership settings or post adverts.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'autopartner-setup') {
    const channel = interaction.options.getChannel('channel', true);
    const hours = interaction.options.getInteger('interval_hours', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    const minimumMembers = interaction.options.getInteger('minimum_members') ?? 100;
    setSetting(interaction.guildId, 'autopartner_min_members', minimumMembers);
    setSetting(interaction.guildId, 'autopartner_channel_id', channel.id);
    setSetting(interaction.guildId, 'autopartner_interval_hours', hours);
    setSetting(interaction.guildId, 'autopartner_enabled', enabled ? 'true' : 'false');
    await interaction.reply({ content: '🤝 Autopartner settings saved.\nChannel: <#' + channel.id + '>\nInterval: every ' + hours + ' hour(s)\nMinimum member count: ' + minimumMembers + '\nAutomatic posting: ' + (enabled ? 'ON' : 'OFF') + '\nMembers can submit a Discord invite with /partner-add; the bot verifies the approximate member count before saving and posting it.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'partner-add') {
    const partnerName = interaction.options.getString('name', true).trim();
    const inviteUrl = interaction.options.getString('invite', true).trim();
    const description = interaction.options.getString('description', true).trim();
    let parsed;
    try { parsed = new URL(inviteUrl); } catch { parsed = null; }
    const host = parsed?.hostname.toLowerCase();
    if (!parsed || parsed.protocol !== 'https:' || !['discord.gg', 'www.discord.gg', 'discord.com', 'www.discord.com'].includes(host) || (host.includes('discord.com') && !parsed.pathname.startsWith('/invite/'))) {
      await interaction.reply({ content: 'Provide a valid HTTPS Discord invite, such as https://discord.gg/example.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!partnerName || !description) {
      await interaction.reply({ content: 'Partner name and description cannot be blank.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const minimum = Number(getSetting(interaction.guildId, 'autopartner_min_members') || 100);
    let invite;
    try { invite = await interaction.client.fetchInvite(parsed.toString(), { withCounts: true }); }
    catch (error) {
      await interaction.editReply('I could not verify that invite or read its member count. Check that the invite is valid and not expired.');
      return true;
    }
    const memberCount = Number(invite.approximateMemberCount);
    if (!Number.isFinite(memberCount) || memberCount < 1) {
      await interaction.editReply('Discord did not provide an approximate member count for that invite, so I cannot verify it.');
      return true;
    }
    if (invite.guild?.id === interaction.guildId) {
      await interaction.editReply('You cannot submit the Meta Code home server as its own partner.');
      return true;
    }
    if (memberCount < minimum) {
      await interaction.editReply('This server currently reports about ' + memberCount.toLocaleString() + ' members. The minimum is ' + minimum.toLocaleString() + ', so it was not added.');
      return true;
    }
    const submissionsToday = db.prepare("SELECT COUNT(*) AS total FROM autopartner_partners WHERE guild_id = ? AND created_by = ? AND created_at >= datetime('now', '-1 day')").get(interaction.guildId, interaction.user.id)?.total || 0;
    if (submissionsToday >= 3) {
      await interaction.editReply('You have reached the limit of 3 qualifying partner submissions per 24 hours.');
      return true;
    }
    const duplicate = db.prepare('SELECT id FROM autopartner_partners WHERE guild_id = ? AND invite_url = ?').get(interaction.guildId, parsed.toString());
    if (duplicate) {
      await interaction.editReply('That invite is already in the automatic partner rotation.');
      return true;
    }
    try {
      db.prepare('INSERT INTO autopartner_partners (guild_id, name, invite_url, description, created_by, member_count) VALUES (?, ?, ?, ?, ?, ?)')
        .run(interaction.guildId, partnerName, parsed.toString(), description, interaction.user.id, memberCount);
    } catch (error) {
      if (String(error.code).includes('CONSTRAINT')) {
        await interaction.editReply('A partner with that name already exists. Use a different name or ask an administrator to update the existing entry.');
        return true;
      }
      throw error;
    }
    const partner = db.prepare('SELECT id, name, invite_url, description, member_count FROM autopartner_partners WHERE guild_id = ? AND invite_url = ?').get(interaction.guildId, parsed.toString());
    const channelId = getSetting(interaction.guildId, 'autopartner_channel_id');
    const channel = channelId ? await interaction.client.channels.fetch(channelId).catch(() => null) : null;
    if (!channel?.isTextBased() || !channel.send) {
      await interaction.editReply('The invite passed the member check and was saved, but no valid partner posting channel is configured. An administrator must run /autopartner-setup.');
      return true;
    }
    try {
      const message = await postPartner(interaction.client, interaction.guildId, partner);
      await interaction.editReply('✅ ' + partnerName + ' qualified with approximately ' + memberCount.toLocaleString() + ' members and was posted in <#' + message.channelId + '>. No staff approval was needed.');
    } catch (error) {
      await interaction.editReply('The server passed the member check and was saved for automatic rotation, but the post failed: ' + error.message);
    }
    return true;
  }

  if (name === 'partner-remove') {
    const partnerName = interaction.options.getString('name', true).trim();
    const result = db.prepare('DELETE FROM autopartner_partners WHERE guild_id = ? AND name = ? COLLATE NOCASE').run(interaction.guildId, partnerName);
    await interaction.reply({ content: result.changes ? 'Removed ' + partnerName + ' from the partner rotation.' : 'No partner named ' + partnerName + ' was found.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'partner-list') {
    const partners = getPartners(interaction.guildId);
    const embed = new EmbedBuilder().setColor(0x42B883).setTitle('🤝 Approved partners')
      .setDescription(partners.length ? partners.map((p, i) => '**' + (i + 1) + '. ' + p.name + '** (' + Number(p.member_count || 0).toLocaleString() + ' approx. members)\n' + p.description.slice(0, 180) + '\n[Join partner server](' + p.invite_url + ')').join('\n\n').slice(0, 4000) : 'No qualifying partners yet. Members can submit a Discord invite with /partner-add.')
      .setFooter({ text: partners.length + ' active partner(s)' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return true;
  }

  if (name === 'partner-settings') {
    const channelId = getSetting(interaction.guildId, 'autopartner_channel_id');
    const hours = getSetting(interaction.guildId, 'autopartner_interval_hours') || '24';
    const enabled = getSetting(interaction.guildId, 'autopartner_enabled') === 'true';
    const minimumMembers = Number(getSetting(interaction.guildId, 'autopartner_min_members') || 100);
    const last = Number(getSetting(interaction.guildId, 'autopartner_last_posted_at') || 0);
    const template = getSetting(interaction.guildId, 'autopartner_template') || defaultTemplate();
    const embed = new EmbedBuilder().setColor(enabled ? 0x42B883 : 0x808080).setTitle('Autopartner configuration')
      .addFields(
        { name: 'Status', value: enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Interval', value: 'Every ' + hours + ' hour(s)', inline: true },
        { name: 'Eligible partners', value: String(getPartners(interaction.guildId).length), inline: true },
        { name: 'Posting channel', value: channelId ? '<#' + channelId + '>' : 'Not configured', inline: true },
        { name: 'Last post', value: last ? '<t:' + Math.floor(last / 1000) + ':R>' : 'Never', inline: true },
        { name: 'Template', value: template.slice(0, 900), inline: false },
      ).setFooter({ text: 'Admins: /autopartner-setup and /partner-template to edit' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return true;
  }

  if (name === 'partner-template') {
    const template = interaction.options.getString('template', true).trim();
    if (!template || !template.includes('{name}') || !template.includes('{invite}') || !template.includes('{description}')) {
      await interaction.reply({ content: 'Template must include all three placeholders: {name}, {invite}, and {description}.', flags: MessageFlags.Ephemeral });
      return true;
    }
    setSetting(interaction.guildId, 'autopartner_template', template);
    await interaction.reply({ content: '✅ Partner advert template saved. The next post will use it.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'partner-post') {
    const requested = interaction.options.getString('name')?.trim();
    const partners = getPartners(interaction.guildId);
    if (!partners.length) {
      await interaction.reply({ content: 'No approved partners yet. Add one with /partner-add first.', flags: MessageFlags.Ephemeral });
      return true;
    }
    let partner;
    if (requested) {
      partner = partners.find(p => p.name.toLowerCase() === requested.toLowerCase());
      if (!partner) {
        await interaction.reply({ content: 'No approved partner named ' + requested + '. Check /partner-list.', flags: MessageFlags.Ephemeral });
        return true;
      }
    } else {
      const lastId = Number(getSetting(interaction.guildId, 'autopartner_last_partner_id') || 0);
      partner = partners.find(p => p.id !== lastId) || partners[0];
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const message = await postPartner(interaction.client, interaction.guildId, partner);
      await interaction.editReply('Posted ' + partner.name + ' in <#' + message.channelId + '>.');
    } catch (error) {
      await interaction.editReply('Could not post partner advert: ' + error.message);
    }
    return true;
  }

  return false;
}

export async function runAutoPartnerScheduler(client) {
  // The website stores owner-managed bot settings under the global key, while
  // approved partner records remain scoped to the configured Meta home server.
  // Resolve the global setting to that server before looking up its partners.
  const guildId = String(process.env.META_HOME_GUILD_ID || process.env.DISCORD_GUILD_ID || '').trim();
  if (!/^\d{17,20}$/.test(guildId)) return;
  if (getSetting(guildId, 'autopartner_enabled') !== 'true') return;

  const channelId = getSetting(guildId, 'autopartner_channel_id');
  const hours = Number(getSetting(guildId, 'autopartner_interval_hours') || 24);
  if (!channelId || !Number.isFinite(hours) || hours < 6 || hours > 168) return;
  const last = Number(getSetting(guildId, 'autopartner_last_posted_at') || 0);
  if (Date.now() - last < hours * 3600000) return;
  const partners = getPartners(guildId);
  if (!partners.length) return;
  const minimum = Number(getSetting(guildId, 'autopartner_min_members') || 100);
  const lastId = Number(getSetting(guildId, 'autopartner_last_partner_id') || 0);
  const ordered = [...partners.filter(item => item.id !== lastId), ...partners.filter(item => item.id === lastId)];
  for (const partner of ordered) {
    try {
      const invite = await client.fetchInvite(partner.invite_url, { withCounts: true });
      const memberCount = Number(invite.approximateMemberCount);
      if (!Number.isFinite(memberCount) || memberCount < minimum) {
        console.log('Autopartner skipped ' + partner.name + ': invite count unavailable or below minimum.');
        continue;
      }
      db.prepare('UPDATE autopartner_partners SET member_count = ? WHERE id = ?').run(memberCount, partner.id);
      const message = await postPartner(client, guildId, { ...partner, member_count: memberCount });
      console.log('Autopartner posted ' + partner.name + ' (' + memberCount + ' members) for Meta home server ' + guildId + ' in channel ' + message.channelId);
      return;
    } catch (error) {
      console.error('Autopartner candidate ' + partner.name + ' was skipped:', error.message);
    }
  }
  console.log('Autopartner: no partner currently meets the ' + minimum + ' member minimum.');
}

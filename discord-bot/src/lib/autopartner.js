import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { db, getSetting, setSetting } from './database.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS autopartner_partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE,
    invite_url TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (guild_id, name)
  );
  CREATE INDEX IF NOT EXISTS autopartner_guild_active ON autopartner_partners (guild_id, id);
  CREATE TABLE IF NOT EXISTS autopartner_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    invite_url TEXT NOT NULL,
    invite_code TEXT NOT NULL,
    description TEXT NOT NULL,
    member_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','eligible','posted','expired')),
    last_checked_at INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    posted_at TEXT,
    UNIQUE (guild_id, invite_code)
  );
  CREATE INDEX IF NOT EXISTS autopartner_submissions_due ON autopartner_submissions(guild_id, status, last_checked_at);
`);
if (!db.pragma('table_info(autopartner_submissions)').some(column => column.name === 'approval_status')) {
  db.exec("ALTER TABLE autopartner_submissions ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'");
}
if (!db.pragma('table_info(autopartner_submissions)').some(column => column.name === 'review_message_id')) {
  db.exec('ALTER TABLE autopartner_submissions ADD COLUMN review_message_id TEXT');
}

const admin = PermissionFlagsBits.Administrator;
const channelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export const autoPartnerCommands = [
  new SlashCommandBuilder().setName('autopartner-setup').setDescription('Configure automatic partner posts')
    .setDefaultMemberPermissions(admin)
    .addChannelOption(o => o.setName('channel').setDescription('Where partner adverts are posted').addChannelTypes(...channelTypes).setRequired(true))
    .addIntegerOption(o => o.setName('interval_hours').setDescription('Hours between posts (6–168)').setMinValue(6).setMaxValue(168).setRequired(true))
    .addIntegerOption(o => o.setName('minimum_members').setDescription('Minimum approximate members for automatic partner eligibility').setMinValue(1).setMaxValue(10000000).setRequired(false))
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable automatic posting').setRequired(true)),
  new SlashCommandBuilder().setName('partner-add').setDescription('Add a manual backup partner server')
    .setDefaultMemberPermissions(admin)
    .addStringOption(o => o.setName('name').setDescription('Unique partner name').setMaxLength(60).setRequired(true))
    .addStringOption(o => o.setName('invite').setDescription('Discord invite URL').setMaxLength(200).setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Partner community description').setMaxLength(700).setRequired(true)),
  new SlashCommandBuilder().setName('partner-submit').setDescription('Submit a partner server for automatic member-count verification')
    .addStringOption(o => o.setName('name').setDescription('Community name').setMaxLength(60).setRequired(true))
    .addStringOption(o => o.setName('invite').setDescription('Permanent or active Discord invite URL').setMaxLength(200).setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Short community description').setMaxLength(700).setRequired(true)),
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

async function requestPartnerApproval(client, guildId, submission) {
  if (submission.review_message_id) return;
  const reviewChannelId = getSetting(guildId, 'autopartner_review_channel_id') || getSetting(guildId, 'community_log_channel_id');
  const channel = reviewChannelId ? await client.channels.fetch(reviewChannelId).catch(() => null) : null;
  if (!channel?.isTextBased() || typeof channel.send !== 'function') {
    console.error('Autopartner approval is required, but no private review channel is configured for guild ' + guildId);
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('Partner submission awaiting approval')
    .setDescription('**' + submission.name + '**\n' + submission.description.slice(0, 1200) + '\n\n[Open Discord invite](' + submission.invite_url + ')')
    .addFields(
      { name: 'Approximate members', value: Number(submission.member_count || 0).toLocaleString(), inline: true },
      { name: 'Submitted by', value: '<@' + submission.user_id + '>', inline: true }
    )
    .setFooter({ text: 'Meta Code • Partner review' })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('partner_review:approve:' + submission.id).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('partner_review:reject:' + submission.id).setLabel('Reject').setStyle(ButtonStyle.Danger)
  );
  const message = await channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
  db.prepare('UPDATE autopartner_submissions SET review_message_id = ? WHERE id = ?').run(message.id, submission.id);
}

function renderEmbed(partner, guildId) {
  const template = getSetting(guildId, 'autopartner_template') || defaultTemplate();
  const description = template.replaceAll('{name}', partner.name).replaceAll('{invite}', partner.invite_url).replaceAll('{description}', partner.description);
  const color = Number(getSetting(guildId, 'bot_embed_color') || 0x42B883);
  return new EmbedBuilder().setColor(Number.isInteger(color) && color >= 0 && color <= 0xFFFFFF ? color : 0x42B883).setTitle('🤝 Community Partner')
    .setDescription(description.slice(0, 4000)).setFooter({ text: getSetting(guildId, 'bot_embed_footer') || 'Meta Code • Community partnerships' }).setTimestamp();
}

async function postPartner(client, guildId, partner) {
  const channelId = getSetting(guildId, 'autopartner_channel_id');
  if (!channelId) throw new Error('No partner channel configured. Run /autopartner-setup first.');
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.send) throw new Error('The configured partner channel is unavailable. Run /autopartner-setup again.');
  const message = await channel.send({ embeds: [renderEmbed(partner, guildId)], allowedMentions: { parse: [] } });
  setSetting(guildId, 'autopartner_last_posted_at', String(Date.now()));
  if (partner.id !== null && partner.id !== undefined) {
    setSetting(guildId, 'autopartner_last_partner_id', String(partner.id));
  }
  return message;
}

export async function handleAutoPartnerCommand(interaction) {
  const name = interaction.commandName;
  if (!name.startsWith('partner-') && name !== 'autopartner-setup') return false;
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Use partnership commands inside a server.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (['autopartner-setup', 'partner-add', 'partner-remove', 'partner-template', 'partner-post'].includes(name) && !isAdmin(interaction)) {
    await interaction.reply({ content: 'Only server administrators can change partnership settings or post adverts.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'autopartner-setup') {
    const channel = interaction.options.getChannel('channel', true);
    const hours = interaction.options.getInteger('interval_hours', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    const minimumMembers = interaction.options.getInteger('minimum_members') ?? Number(getSetting(interaction.guildId, 'autopartner_min_members') || 100);
    setSetting(interaction.guildId, 'autopartner_channel_id', channel.id);
    setSetting(interaction.guildId, 'autopartner_interval_hours', hours);
    setSetting(interaction.guildId, 'autopartner_min_members', minimumMembers);
    setSetting(interaction.guildId, 'autopartner_enabled', enabled ? 'true' : 'false');
    await interaction.reply({ content: '🤝 Autopartner settings saved.\nChannel: <#' + channel.id + '>\nInterval: every ' + hours + ' hour(s)\nMinimum members: ' + minimumMembers.toLocaleString() + '\nAutomatic posting: ' + (enabled ? 'ON' : 'OFF') + '\nMembers can submit partners with /partner-submit. Meta checks the invite count automatically; no staff approval is required.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (name === 'partner-submit') {
    const partnerName = interaction.options.getString('name', true).trim();
    const inviteUrl = interaction.options.getString('invite', true).trim();
    const description = interaction.options.getString('description', true).trim();
    const channelId = getSetting(interaction.guildId, 'autopartner_channel_id');
    if (getSetting(interaction.guildId, 'autopartner_enabled') !== 'true' || !channelId) {
      await interaction.reply({ content: 'Automatic partnerships are not open right now. Please check back later.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!partnerName || !description) {
      await interaction.reply({ content: 'Community name and description cannot be blank.', flags: MessageFlags.Ephemeral });
      return true;
    }
    let parsed, inviteCode;
    try {
      parsed = new URL(inviteUrl);
      const host = parsed.hostname.toLowerCase();
      const validHost = ['discord.gg', 'www.discord.gg', 'discord.com', 'www.discord.com'].includes(host);
      const segments = parsed.pathname.split('/').filter(Boolean);
      inviteCode = host.includes('discord.com') ? (segments[0] === 'invite' ? segments[1] : null) : segments[0];
      if (!validHost || parsed.protocol !== 'https:' || !inviteCode || (host.includes('discord.com') && segments[0] !== 'invite')) throw new Error('invalid');
    } catch {
      await interaction.reply({ content: 'Provide a valid HTTPS Discord invite, such as https://discord.gg/example.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const priorInvite = db.prepare('SELECT id, status, member_count FROM autopartner_submissions WHERE guild_id = ? AND invite_code = ?').get(interaction.guildId, inviteCode);
    if (priorInvite) {
      const minimum = Number(getSetting(interaction.guildId, 'autopartner_min_members') || 100);
      const message = priorInvite.status === 'posted'
        ? 'That invite has already been published as a partner.'
        : priorInvite.status === 'eligible'
          ? 'That invite already passed the member-count check and is waiting for its scheduled post.'
          : 'That invite is already being checked. Latest approximate count: ' + Number(priorInvite.member_count || 0).toLocaleString() + ' / ' + minimum.toLocaleString() + ' members.';
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
      return true;
    }
    const recentUserSubmission = db.prepare("SELECT id FROM autopartner_submissions WHERE guild_id = ? AND user_id = ? AND created_at >= datetime('now', '-7 days')").get(interaction.guildId, interaction.user.id);
    if (recentUserSubmission) {
      await interaction.reply({ content: 'For fairness, each member can submit one partner every 7 days. Your previous submission is still within that period.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const existingUserSubmission = db.prepare("SELECT id FROM autopartner_submissions WHERE guild_id = ? AND user_id = ? AND status IN ('pending','eligible')").get(interaction.guildId, interaction.user.id);
    if (existingUserSubmission) {
      await interaction.reply({ content: 'You already have a partner submission being checked. Please wait for the automatic review to finish.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const invite = await interaction.client.fetchInvite(inviteUrl, { withCounts: true });
      const memberCount = Number(invite.approximateMemberCount);
      if (!Number.isFinite(memberCount) || memberCount < 1 || !invite.guild?.id) {
        await interaction.editReply('Discord did not return a usable member count for that invite. Please submit an active server invite.');
        return true;
      }
      if (invite.guild.id === interaction.guildId) {
        await interaction.editReply('Meta Code cannot be submitted as its own partner.');
        return true;
      }
      const minimum = Number(getSetting(interaction.guildId, 'autopartner_min_members') || 100);
      const normalizedInvite = 'https://discord.gg/' + invite.code;
      const status = memberCount >= minimum ? 'eligible' : 'pending';
      const result = db.prepare(`
        INSERT INTO autopartner_submissions
          (guild_id, user_id, name, invite_url, invite_code, description, member_count, status, last_checked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, invite_code) DO UPDATE SET
          user_id=excluded.user_id, name=excluded.name, description=excluded.description,
          member_count=excluded.member_count, status=CASE WHEN excluded.status='eligible' THEN 'eligible' ELSE autopartner_submissions.status END,
          last_checked_at=excluded.last_checked_at
      `).run(interaction.guildId, interaction.user.id, partnerName, normalizedInvite, invite.code, description, memberCount, status, Date.now());
      if (status === 'eligible') {
        db.prepare(`
          INSERT INTO autopartner_partners (guild_id, name, invite_url, description, created_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(guild_id, name) DO UPDATE SET invite_url=excluded.invite_url, description=excluded.description
        `).run(interaction.guildId, partnerName, normalizedInvite, description, interaction.user.id);
        await interaction.editReply('✅ **Member-count check passed.** Discord reports approximately ' + memberCount.toLocaleString() + ' members (minimum ' + minimum.toLocaleString() + '). The server is now eligible for automatic posting; staff approval is not required.');
        await runAutoPartnerScheduler(interaction.client);
      } else {
        await interaction.editReply('Thanks! Discord reports approximately ' + memberCount.toLocaleString() + ' members. The requirement is ' + minimum.toLocaleString() + '. Meta will automatically recheck this invite periodically and add it to the posting rotation when it qualifies. No staff approval is required.');
      }
    } catch (error) {
      if (String(error?.code || '').includes('CONSTRAINT')) {
        await interaction.editReply('That invite has already been submitted.');
      } else {
        await interaction.editReply('Could not verify that Discord invite: ' + (error?.message || 'unknown error'));
      }
    }
    return true;
  }

  if (name === 'partner-add') {
    const partnerName = interaction.options.getString('name', true).trim();
    const invite = interaction.options.getString('invite', true).trim();
    const description = interaction.options.getString('description', true).trim();
    let parsed;
    try { parsed = new URL(invite); } catch { parsed = null; }
    const host = parsed?.hostname.toLowerCase();
    if (!parsed || parsed.protocol !== 'https:' || !['discord.gg', 'www.discord.gg', 'discord.com', 'www.discord.com'].includes(host) || (host.includes('discord.com') && !parsed.pathname.startsWith('/invite/'))) {
      await interaction.reply({ content: 'Provide a valid HTTPS Discord invite, such as https://discord.gg/example.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!partnerName || !description) {
      await interaction.reply({ content: 'Partner name and description cannot be blank.', flags: MessageFlags.Ephemeral });
      return true;
    }
    try {
      db.prepare('INSERT INTO autopartner_partners (guild_id, name, invite_url, description, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(interaction.guildId, partnerName, parsed.toString(), description, interaction.user.id);
    } catch (error) {
      if (String(error.code).includes('CONSTRAINT')) {
        await interaction.reply({ content: 'A partner with that name already exists. Remove it first or choose another name.', flags: MessageFlags.Ephemeral });
        return true;
      }
      throw error;
    }
    await interaction.reply({ content: '✅ Added ' + partnerName + ' as a manual backup partner. Use /partner-post to preview it in the configured channel.', flags: MessageFlags.Ephemeral });
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
    const embed = new EmbedBuilder().setColor(0x42B883).setTitle('🤝 Partners in rotation')
      .setDescription(partners.length ? partners.map((p, i) => '**' + (i + 1) + '. ' + p.name + '**\n' + p.description.slice(0, 180) + '\n[Join partner server](' + p.invite_url + ')').join('\n\n').slice(0, 4000) : 'No partners yet. Members can submit with /partner-submit for automatic member-count verification.')
      .setFooter({ text: partners.length + ' active partner(s)' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return true;
  }

  if (name === 'partner-settings') {
    const channelId = getSetting(interaction.guildId, 'autopartner_channel_id');
    const hours = getSetting(interaction.guildId, 'autopartner_interval_hours') || '24';
    const enabled = getSetting(interaction.guildId, 'autopartner_enabled') === 'true';
    const last = Number(getSetting(interaction.guildId, 'autopartner_last_posted_at') || 0);
    const template = getSetting(interaction.guildId, 'autopartner_template') || defaultTemplate();
    const embed = new EmbedBuilder().setColor(enabled ? 0x42B883 : 0x808080).setTitle('Autopartner configuration')
      .addFields(
        { name: 'Status', value: enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Interval', value: 'Every ' + hours + ' hour(s)', inline: true },
        { name: 'Partners in rotation', value: String(getPartners(interaction.guildId).length), inline: true },
        { name: 'Minimum members', value: Number(getSetting(interaction.guildId, 'autopartner_min_members') || 100).toLocaleString(), inline: true },
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
      await interaction.reply({ content: 'No partners in the rotation yet. Submit a qualifying server with /partner-submit or add a manual backup with /partner-add.', flags: MessageFlags.Ephemeral });
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

async function verifyPendingSubmissions(client, guildId) {
  const due = db.prepare(`
    SELECT * FROM autopartner_submissions
    WHERE guild_id = ? AND status = 'pending' AND last_checked_at <= ?
    ORDER BY id LIMIT 10
  `).all(guildId, Date.now() - 30 * 60_000);
  const minimum = Number(getSetting(guildId, 'autopartner_min_members') || 100);
  for (const submission of due) {
    db.prepare('UPDATE autopartner_submissions SET last_checked_at = ? WHERE id = ?').run(Date.now(), submission.id);
    try {
      const invite = await client.fetchInvite(submission.invite_url, { withCounts: true });
      const count = Number(invite.approximateMemberCount);
      if (!Number.isFinite(count) || count < 1) continue;
      db.prepare('UPDATE autopartner_submissions SET member_count = ? WHERE id = ?').run(count, submission.id);
      if (count < minimum) continue;
      db.prepare(`
        INSERT INTO autopartner_partners (guild_id, name, invite_url, description, created_by)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, name) DO UPDATE SET invite_url=excluded.invite_url, description=excluded.description
      `).run(guildId, submission.name, submission.invite_url, submission.description, submission.user_id);
      db.prepare("UPDATE autopartner_submissions SET status = 'eligible' WHERE id = ?").run(submission.id);
      console.log('Autopartner submission passed member-count check:', submission.name, count);
    } catch (error) {
      // A temporary API/network error leaves the submission pending for the next check.
      console.warn('Autopartner invite recheck failed for submission ' + submission.id + ':', error.message);
    }
  }
}

export async function runAutoPartnerScheduler(client) {
  const guildId = String(process.env.META_HOME_GUILD_ID || process.env.DISCORD_GUILD_ID || '').trim();
  if (!/^\d{17,20}$/.test(guildId)) return;
  if (getSetting(guildId, 'autopartner_enabled') !== 'true') return;

  const channelId = getSetting(guildId, 'autopartner_channel_id');
  const hours = Number(getSetting(guildId, 'autopartner_interval_hours') || 24);
  const minimum = Number(getSetting(guildId, 'autopartner_min_members') || 100);
  if (!channelId || !Number.isFinite(hours) || hours < 6 || hours > 168 ||
      !Number.isInteger(minimum) || minimum < 1 || minimum > 10000000) return;

  await verifyPendingSubmissions(client, guildId);
  const last = Number(getSetting(guildId, 'autopartner_last_posted_at') || 0);
  if (Date.now() - last < hours * 3600000) return;

  const eligible = db.prepare("SELECT * FROM autopartner_submissions WHERE guild_id = ? AND status = 'eligible' ORDER BY id LIMIT 1").get(guildId);
  if (eligible) {
    const partner = { id: null, name: eligible.name, invite_url: eligible.invite_url, description: eligible.description };
    try {
      const message = await postPartner(client, guildId, partner);
      db.prepare("UPDATE autopartner_submissions SET status = 'posted', posted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'eligible'").run(eligible.id);
      console.log('Autopartner posted qualifying public submission ' + eligible.name + ' in ' + message.channelId);
    } catch (error) {
      console.error('Autopartner qualifying submission could not be posted:', error.message);
    }
    return;
  }

  const partners = getPartners(guildId);
  if (!partners.length) return;
  const lastId = Number(getSetting(guildId, 'autopartner_last_partner_id') || 0);
  const partner = partners.find(item => item.id !== lastId) || partners[0];
  try {
    await postPartner(client, guildId, partner);
    console.log('Autopartner posted ' + partner.name + ' for Meta home server ' + guildId);
  } catch (error) {
    console.error('Autopartner failed for Meta home server ' + guildId + ':', error.message);
  }
}

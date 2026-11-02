import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
  MessageFlags,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

import {
  getSetting,
  setSetting
} from './database.js';

const configured = (guildId, key) => {
  const value = getSetting(guildId, key);
  return value && value !== 'not_configured' && value !== 'pending'
    ? value
    : null;
};

// A role mention only creates a Discord notification when the role is mentionable
// or the bot has MentionEveryone. Prefer making the configured staff role mentionable
// during setup so ticket alerts work without granting the bot broad mention permissions.
export async function ensureStaffRolePingable(guild, role) {
  if (role.mentionable) return true;

  let botMember = guild.members?.me;
  if (!botMember && typeof guild.members?.fetchMe === 'function') {
    botMember = await guild.members.fetchMe().catch(() => null);
  }

  if (botMember?.permissions?.has(PermissionFlagsBits.MentionEveryone)) return true;
  if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles) ||
      !role.editable || typeof role.setMentionable !== 'function') {
    return false;
  }

  await role.setMentionable(true, 'Enable immediate ticket staff notifications');
  return true;
}

const isStaff = (interaction, roleId) =>
  Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    (roleId && interaction.member?.roles?.cache?.has(roleId))
  );

async function replyPrivate(interaction, content, components = []) {
  const payload = { content, flags: MessageFlags.Ephemeral, ...(components.length ? { components } : {}) };
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

async function findTicket(db, channelId, guildId) {
  return db.prepare(
    'SELECT * FROM tickets WHERE channel_id = ? AND guild_id = ?'
  ).get(channelId, guildId);
}

function findTicketById(db, ticketId, guildId) {
  return db.prepare('SELECT * FROM tickets WHERE id = ? AND guild_id = ?').get(ticketId, guildId);
}

function ticketCloseDelaySeconds(guildId) {
  const value = Number(configured(guildId, 'ticket_close_delay_seconds') || 5);
  return Number.isInteger(value) && value >= 1 && value <= 300 ? value : 5;
}

function ticketCloseRow(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close_' + ticketId)
      .setLabel('Close ticket').setStyle(ButtonStyle.Danger)
  );
}

function ticketCloseConfirmationRow(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close_confirm_' + ticketId)
      .setLabel('Confirm close').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_close_cancel_' + ticketId)
      .setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
}

async function archiveTicketTranscript(guild, channel, ticket, closedBy) {
  const logChannelId = configured(guild.id, 'ticket_log_channel_id');
  const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;
  if (!logChannel || !logChannel.isTextBased() || typeof logChannel.send !== 'function') {
    throw new Error('The configured ticket log channel is unavailable; the ticket was not deleted.');
  }
  const messages = [];
  let before;
  for (let page = 0; page < 20; page++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  const transcript = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(message => '[' + new Date(message.createdTimestamp).toISOString() + '] ' +
      message.author.tag + ': ' + (message.content || '[No text content]'))
    .join('\n');
  const file = new AttachmentBuilder(Buffer.from(transcript || 'No messages to include.', 'utf8'),
    { name: 'ticket-' + ticket.id + '-transcript.txt' });
  await logChannel.send({
    content: 'ID: #' + ticket.id + ' · Ticket closed by <@' + closedBy.id +
      '> · Archived from <#' + channel.id + '>. Reopen with /ticket reopen id:' + ticket.id,
    files: [file],
    allowedMentions: { users: [closedBy.id] }
  });
}

export async function runPendingTicketDeletions(client, database) {
  if (!database) throw new Error('Ticket deletion worker was not given a database connection.');
  const due = database.prepare("SELECT id, guild_id, channel_id FROM tickets WHERE status = 'closed' AND delete_at IS NOT NULL AND delete_at <= ?")
    .all(Date.now());
  for (const ticket of due) {
    const guild = client.guilds.cache.get(ticket.guild_id);
    const channel = guild ? await guild.channels.fetch(ticket.channel_id).catch(() => null) : null;
    if (channel) {
      try { await channel.delete('Confirmed support ticket closure'); }
      catch (error) {
        console.error('Could not delete closed ticket #' + ticket.id + ':', error.message);
        continue;
      }
    }
    database.prepare('UPDATE tickets SET delete_at = NULL WHERE id = ? AND status = ?')
      .run(ticket.id, 'closed');
    console.log('Closed ticket #' + ticket.id + ' channel deletion completed.');
  }
}


async function reopenTicketById(interaction, database, guild, guildId, staffRoleId) {
  if (!isStaff(interaction, staffRoleId)) return replyPrivate(interaction, 'Only ticket staff can reopen tickets.');
  const ticketId = interaction.options.getInteger('id', true);
  const ticket = findTicketById(database, ticketId, guildId);
  if (!ticket) return replyPrivate(interaction, 'Ticket #' + ticketId + ' was not found in this server.');
  if (ticket.status === 'open') return replyPrivate(interaction, 'Ticket #' + ticketId + ' is already open.');

  const categoryId = configured(guildId, 'ticket_category_id');
  const staffRole = staffRoleId ? await guild.roles.fetch(staffRoleId).catch(() => null) : null;
  const category = categoryId ? await guild.channels.fetch(categoryId).catch(() => null) : null;
  if (!category || category.type !== ChannelType.GuildCategory || !staffRole) {
    return replyPrivate(interaction, 'Ticket category or staff role is no longer configured. Ask an administrator to run /ticket setup.');
  }
  if (!(await ensureStaffRolePingable(guild, staffRole))) {
    return replyPrivate(interaction, 'Meta cannot notify the configured staff role. Make it mentionable or grant Meta Manage Roles with the staff role below its highest role.');
  }
  const member = await guild.members.fetch(ticket.user_id).catch(() => null);
  if (!member) return replyPrivate(interaction, 'The original ticket creator is no longer in this server. They must rejoin before this ticket can be reopened.');

  let channel = await guild.channels.fetch(ticket.channel_id).catch(() => null);
  if (!channel) {
    const safeName = member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 28) || 'member';
    const categorySlug = ticket.category.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'support';
    channel = await guild.channels.create({
      name: ('ticket-' + categorySlug + '-' + safeName).slice(0, 95),
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Ticket #' + ticket.id + ' · Reopened for ' + member.user.tag,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] }
      ],
      reason: 'Reopen support ticket #' + ticket.id
    });
  } else {
    await channel.permissionOverwrites.edit(ticket.user_id, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
    });
  }

  database.prepare("UPDATE tickets SET status = 'open', channel_id = ?, closed_at = NULL, delete_at = NULL WHERE id = ?")
    .run(channel.id, ticket.id);
  await channel.send({
    content: '<@' + ticket.user_id + '> <@&' + staffRole.id + '>',
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Support Ticket #' + ticket.id + ' Reopened')
      .setDescription('This support ticket has been reopened. The original ticket creator has been given access again.')
      .addFields({ name: 'Category', value: ticket.category, inline: true }, { name: 'Opened by', value: member.user.tag, inline: true })],
    components: [ticketCloseRow(ticket.id)],
    allowedMentions: { users: [ticket.user_id], roles: [staffRole.id] }
  });
  const logId = configured(guildId, 'ticket_log_channel_id');
  const logChannel = logId ? await guild.channels.fetch(logId).catch(() => null) : null;
  if (logChannel?.isTextBased()) {
    await logChannel.send({
      content: 'ID: #' + ticket.id + ' · Ticket reopened by <@' + interaction.user.id +
        '>. Original creator: <@' + ticket.user_id + '> · New channel: <#' + channel.id + '>.',
      allowedMentions: { users: [interaction.user.id, ticket.user_id] }
    });
  }
  return replyPrivate(interaction, 'Ticket #' + ticket.id + ' reopened: <#' + channel.id + '>. The original creator has been added back.');
}

async function handleTicketControlButton(interaction, database) {
  const customId = interaction.customId || '';
  const confirmMatch = customId.match(/^ticket_close_(confirm|cancel)_(\d+)$/);
  const startMatch = customId.match(/^ticket_close_(\d+)$/);
  if (!confirmMatch && !startMatch) return false;
  const ticketId = Number(confirmMatch ? confirmMatch[2] : startMatch[1]);
  const ticket = findTicketById(database, ticketId, interaction.guildId);
  if (!ticket || ticket.channel_id !== interaction.channelId) {
    await replyPrivate(interaction, 'This ticket button is no longer valid.');
    return true;
  }
  const staffRoleId = configured(interaction.guildId, 'ticket_staff_role_id');
  if (ticket.user_id !== interaction.user.id && !isStaff(interaction, staffRoleId)) {
    await replyPrivate(interaction, 'Only the ticket creator or ticket staff can close this ticket.');
    return true;
  }
  if (startMatch) {
    if (ticket.status !== 'open') {
      await replyPrivate(interaction, 'This ticket is already closing or closed.');
      return true;
    }
    await interaction.reply({
      content: 'Are you sure you want to close ticket #' + ticket.id +
        '? The conversation will be archived, then this channel will be deleted.',
      components: [ticketCloseConfirmationRow(ticket.id)],
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
  if (confirmMatch[1] === 'cancel') {
    await interaction.update({ content: 'Ticket closure cancelled. The ticket is still open.', components: [] });
    return true;
  }
  if (ticket.status !== 'open') {
    await interaction.update({ content: 'This ticket is already closing or closed.', components: [] });
    return true;
  }
  await interaction.update({ content: 'Archiving ticket #' + ticket.id + ' before deletion…', components: [] });
  try {
    await archiveTicketTranscript(interaction.guild, interaction.channel, ticket, interaction.user);
  } catch (error) {
    console.error('Ticket archive failed:', error.message);
    await interaction.editReply({
      content: 'I could not archive this ticket, so I did not delete the channel. Check the configured ticket log channel and try again.',
      components: []
    }).catch(() => {});
    return true;
  }
  const delaySeconds = ticketCloseDelaySeconds(interaction.guildId);
  const deleteAt = Date.now() + delaySeconds * 1000;
  const scheduled = database.prepare("UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, delete_at = ? WHERE id = ? AND status = 'open'")
    .run(deleteAt, ticket.id);
  const savedSchedule = database.prepare('SELECT status, delete_at FROM tickets WHERE id = ?').get(ticket.id);
  if (scheduled.changes !== 1 || savedSchedule?.status !== 'closed' || Number(savedSchedule.delete_at) !== deleteAt) {
    throw new Error('Ticket #' + ticket.id + ' deletion deadline could not be saved to the ticket database.');
  }
  console.log('Scheduled deletion for ticket #' + ticket.id + ' at ' + deleteAt + ' (in ' + delaySeconds + ' seconds).');
  await interaction.editReply({
    content: 'Ticket #' + ticket.id + ' is closed. This channel will be deleted in ' +
      delaySeconds + ' seconds. Reopen it with /ticket reopen id:' + ticket.id + '.'
  });
  return true;
}

export async function handleTicketCommand(interaction, db) {
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;
  if (!guild) return replyPrivate(interaction, 'Use this command in the server.');

  const guildId = guild.id;
  const staffRoleId = configured(guildId, 'ticket_staff_role_id');

  if (sub === 'setup') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return replyPrivate(interaction, 'Only administrators can configure tickets.');
    }

    const category = interaction.options.getChannel('category');
    const role = interaction.options.getRole('staff_role');
    const logChannel = interaction.options.getChannel('log_channel');

    if (category.type !== ChannelType.GuildCategory ||
        logChannel.type !== ChannelType.GuildText) {
      return replyPrivate(interaction, 'Choose a category and a text channel.');
    }

    const canNotifyStaff = await ensureStaffRolePingable(guild, role);
    if (!canNotifyStaff) {
      return replyPrivate(
        interaction,
        'I cannot enable staff pings. Give Meta the Manage Roles permission with the staff role below Meta’s highest role, or make the staff role mentionable, then run /ticket setup again.'
      );
    }

    setSetting(guildId, 'ticket_category_id', category.id);
    setSetting(guildId, 'ticket_staff_role_id', role.id);
    setSetting(guildId, 'ticket_log_channel_id', logChannel.id);

    return replyPrivate(
      interaction,
      `Ticket settings saved.\nCategory: ${category.name}\nStaff role: ${role.name}\nLog channel: <#${logChannel.id}>`
    );
  }

  if (sub === 'panel') {
    return handleTicketPanelCommand(interaction);
  }

  if (sub === 'reopen') {
    return reopenTicketById(interaction, db, guild, guildId, staffRoleId);
  }

  const ticket = await findTicket(db, interaction.channelId, guildId);
  if (!ticket) {
    return replyPrivate(interaction, 'This command must be used inside an existing ticket channel.');
  }

  const memberOwnsTicket = ticket.user_id === interaction.user.id;
  const staff = isStaff(interaction, staffRoleId);

  if (sub === 'claim') {
    if (!staff) return replyPrivate(interaction, 'Only ticket staff can claim tickets.');
    if (ticket.status !== 'open') return replyPrivate(interaction, 'This ticket is closed.');

    db.prepare('UPDATE tickets SET claimed_by = ? WHERE id = ?')
      .run(interaction.user.id, ticket.id);

    await interaction.channel.send(`🎫 Ticket claimed by ${interaction.user}.`);
    return replyPrivate(interaction, 'You claimed this ticket.');
  }

  if (sub === 'add' || sub === 'remove') {
    if (!staff) return replyPrivate(interaction, 'Only ticket staff can manage ticket members.');

    const user = interaction.options.getUser('member');
    if (sub === 'remove' && user.id === ticket.user_id) {
      return replyPrivate(interaction, 'The ticket creator cannot be removed from their ticket.');
    }

    await interaction.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: sub === 'add',
      SendMessages: sub === 'add',
      ReadMessageHistory: sub === 'add'
    });

    await interaction.channel.send(
      sub === 'add'
        ? `➕ ${user} was added by ${interaction.user}.`
        : `➖ ${user} was removed by ${interaction.user}.`
    );
    return replyPrivate(interaction, `${user.tag} ${sub === 'add' ? 'added to' : 'removed from'} this ticket.`);
  }

  if (sub === 'close') {
    if (!memberOwnsTicket && !staff) return replyPrivate(interaction, 'Only the ticket creator or ticket staff can close this ticket.');
    if (ticket.status === 'closed') return replyPrivate(interaction, 'This ticket is already closed.');
    return replyPrivate(interaction,
      'Confirm closing ticket #' + ticket.id + '? The conversation will be archived, then this channel will be deleted.',
      [ticketCloseConfirmationRow(ticket.id)]);
  }


  if (sub === 'transcript') {
    if (!staff) return replyPrivate(interaction, 'Only ticket staff can create transcripts.');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const messages = [];
    let before;
    for (let page = 0; page < 20; page++) {
      const batch = await interaction.channel.messages.fetch({
        limit: 100,
        ...(before ? { before } : {})
      });
      if (!batch.size) break;

      messages.push(...batch.values());
      before = batch.last().id;
      if (batch.size < 100) break;
    }

    const transcript = messages
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(message => {
        const body = message.content || '[No text content]';
        return `[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag}: ${body}`;
      })
      .join('\n');

    const file = new AttachmentBuilder(
      Buffer.from(transcript || 'No messages to include.', 'utf8'),
      { name: `ticket-${ticket.id}-transcript.txt` }
    );

    const logChannelId = configured(guildId, 'ticket_log_channel_id');
    const logChannel = logChannelId
      ? await guild.channels.fetch(logChannelId).catch(() => null)
      : null;

    if (!logChannel || !logChannel.isTextBased()) {
      return replyPrivate(interaction, 'The ticket log channel is not configured. Ask an administrator to run /ticket setup.');
    }

    await logChannel.send({
      content: `Transcript for ticket #${ticket.id}, created by ${interaction.user.tag}.`,
      files: [file]
    });

    return replyPrivate(interaction, 'Transcript saved to the configured staff log channel.');
  }
}

function ticketCategories(guildId) {
  try {
    const parsed = JSON.parse(getSetting(guildId, 'ticket_categories') || '["General Support","Bug Report","Website Help","Partnership","Other"]');
    if (Array.isArray(parsed)) {
      const names = parsed.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean).slice(0, 25);
      if (names.length) return names;
    }
  } catch {}
  return ['General Support', 'Bug Report', 'Website Help', 'Partnership', 'Other'];
}

function ticketQuestions(guildId) {
  try {
    const parsed = JSON.parse(getSetting(guildId, 'ticket_form_questions') || '["Briefly describe what you need help with."]');
    if (Array.isArray(parsed)) {
      const questions = parsed.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean).slice(0, 5);
      if (questions.length) return questions;
    }
  } catch {}
  return ['Briefly describe what you need help with.'];
}

function showTicketForm(interaction, categoryName, categoryIndex, guildId) {
  const questions = ticketQuestions(guildId);
  const modal = new ModalBuilder()
    .setCustomId('ticket_form_submit_' + categoryIndex)
    .setTitle(('New ticket · ' + categoryName).slice(0, 45));
  for (const [index, question] of questions.entries()) {
    const input = new TextInputBuilder()
      .setCustomId('ticket_answer_' + index)
      .setLabel(question.slice(0, 45))
      .setStyle(index === 0 ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(1000)
      .setPlaceholder('Enter your answer here');
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return interaction.showModal(modal);
}

export async function handleTicketButton(interaction, db) {
  if (interaction.isButton?.() && await handleTicketControlButton(interaction, db)) return true;
  const isLegacyButton = interaction.customId === 'ticket_create';
  const isCategoryButton = interaction.customId.startsWith('ticket_category_button_');
  const isCategorySelect = interaction.customId === 'ticket_category_select';
  const isFormSubmit = interaction.customId.startsWith('ticket_form_submit_');
  if (!isLegacyButton && !isCategoryButton && !isCategorySelect && !isFormSubmit) return false;

  const guild = interaction.guild;
  if (!guild) {
    await replyPrivate(interaction, 'Open tickets from inside the server.');
    return true;
  }

  const guildId = guild.id;
  const categories = ticketCategories(guildId);
  let selectedCategory = 'General Support';
  let categoryIndex = 0;

  if (isCategorySelect) {
    categoryIndex = Number(interaction.values?.[0]);
    if (!Number.isInteger(categoryIndex) || categoryIndex < 0 || categoryIndex >= categories.length) {
      await replyPrivate(interaction, 'That ticket category is invalid. Please use the ticket panel again.');
      return true;
    }
    selectedCategory = categories[categoryIndex];
    await showTicketForm(interaction, selectedCategory, categoryIndex, guildId);
    return true;
  }

  if (isCategoryButton) {
    categoryIndex = Number(interaction.customId.slice('ticket_category_button_'.length));
    if (!Number.isInteger(categoryIndex) || categoryIndex < 0 || categoryIndex >= categories.length) {
      await replyPrivate(interaction, 'That ticket category is invalid. Please use the ticket panel again.');
      return true;
    }
    selectedCategory = categories[categoryIndex];
    await showTicketForm(interaction, selectedCategory, categoryIndex, guildId);
    return true;
  }

  if (isLegacyButton) {
    selectedCategory = categories[0];
    categoryIndex = 0;
    await showTicketForm(interaction, selectedCategory, categoryIndex, guildId);
    return true;
  }

  categoryIndex = Number(interaction.customId.slice('ticket_form_submit_'.length));
  if (!Number.isInteger(categoryIndex) || categoryIndex < 0 || categoryIndex >= categories.length) {
    await replyPrivate(interaction, 'That ticket category is invalid. Please open a new ticket from the panel.');
    return true;
  }
  selectedCategory = categories[categoryIndex];

  const categoryId = configured(guildId, 'ticket_category_id');
  const staffRoleId = configured(guildId, 'ticket_staff_role_id');
  if (!categoryId || !staffRoleId) {
    await replyPrivate(interaction, 'Tickets are not configured yet. Please contact a server administrator.');
    return true;
  }

  const existing = db.prepare(
    "SELECT channel_id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'"
  ).get(guildId, interaction.user.id);
  if (existing) {
    const channel = await guild.channels.fetch(existing.channel_id).catch(() => null);
    if (channel) {
      await replyPrivate(interaction, 'You already have an open ticket: <#' + channel.id + '>');
      return true;
    }
    db.prepare("UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE channel_id = ?")
      .run(existing.channel_id);
  }

  const category = await guild.channels.fetch(categoryId).catch(() => null);
  const staffRole = await guild.roles.fetch(staffRoleId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory || !staffRole) {
    await replyPrivate(interaction, 'The configured ticket category or staff role no longer exists. Ask an administrator to run /ticket setup.');
    return true;
  }

  const canNotifyStaff = await ensureStaffRolePingable(guild, staffRole);
  if (!canNotifyStaff) {
    await replyPrivate(
      interaction,
      'The ticket staff role cannot be pinged yet. Ask an administrator to make it mentionable or give Meta Manage Roles with the staff role below Meta’s highest role.'
    );
    return true;
  }

  const questions = ticketQuestions(guildId);
  const answers = questions.map((question, index) => ({
    question,
    answer: interaction.fields.getTextInputValue('ticket_answer_' + index)
  }));
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const safeName = interaction.user.username.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 35) || 'member';
  const categorySlug = selectedCategory.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'support';
  let channel;
  try {
    channel = await guild.channels.create({
      name: 'ticket-' + categorySlug + '-' + safeName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Ticket category: ' + selectedCategory + ' · Opened by ' + interaction.user.tag + ' (' + interaction.user.id + ')',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] }
      ],
      reason: 'Support ticket opened by ' + interaction.user.tag
    });

    const insert = db.prepare(
      'INSERT INTO tickets (guild_id, channel_id, user_id, category) VALUES (?, ?, ?, ?)'
    ).run(guildId, channel.id, interaction.user.id, selectedCategory);

    const answerText = answers.map((item, index) => '**' + (index + 1) + '. ' + item.question + '**\n' + item.answer).join('\n\n');
    await channel.send({
      content: '<@' + interaction.user.id + '> <@&' + staffRole.id + '>',
      components: [ticketCloseRow(Number(insert.lastInsertRowid))],
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Support Ticket #' + insert.lastInsertRowid)
        .setDescription('A private support ticket has been opened. Staff will respond here. Never share passwords, verification codes, or other secrets.')
        .addFields(
          { name: 'Category', value: selectedCategory, inline: true },
          { name: 'Opened by', value: interaction.user.tag, inline: true },
          { name: 'Ticket form', value: answerText.slice(0, 1024) || 'No answers provided.' }
        )
      ],
      allowedMentions: { users: [interaction.user.id], roles: [staffRole.id] }
    });

    await interaction.editReply('Your private **' + selectedCategory + '** ticket has been created: <#' + channel.id + '>');
    const logChannelId = configured(guildId, 'ticket_log_channel_id');
    const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;
    if (logChannel?.isTextBased()) {
      await logChannel.send({
        content: 'ID: #' + insert.lastInsertRowid + ' · <@&' + staffRole.id + '> · 🎫 Ticket #' + insert.lastInsertRowid +
          ' (' + selectedCategory + ') opened by <@' + interaction.user.id + '> in <#' + channel.id + '>. Please respond when available.',
        allowedMentions: {
          roles: [staffRole.id],
          users: [interaction.user.id]
        }
      });
    }
  } catch (error) {
    if (channel) await channel.delete('Ticket setup failed').catch(() => {});
    console.error('Ticket creation failed:', error.message);
    await interaction.editReply('I could not create your ticket. Please contact a server administrator.').catch(() => {});
  }
  return true;
}

export async function handleTicketPanelCommand(interaction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await replyPrivate(interaction, 'Only administrators can post the ticket panel.');
    return true;
  }
  const guildId = interaction.guildId;
  const categories = ticketCategories(guildId);
  const style = getSetting(guildId, 'ticket_panel_style') === 'buttons' ? 'buttons' : 'dropdown';
  const title = (configured(guildId, 'ticket_panel_title') || 'Meta Code Support').slice(0, 256);
  const description = (configured(guildId, 'ticket_panel_description') || 'Choose a category to open a ticket. You will complete a short form before your private channel is created. Never share passwords or verification codes.').slice(0, 4000);
  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(description);
  const components = [];
  if (style === 'buttons') {
    for (let i = 0; i < categories.length; i += 5) {
      const row = new ActionRowBuilder();
      for (const [offset, name] of categories.slice(i, i + 5).entries()) {
        const index = i + offset;
        row.addComponents(new ButtonBuilder()
          .setCustomId('ticket_category_button_' + index)
          .setLabel(name.slice(0, 80))
          .setStyle(index === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary));
      }
      components.push(row);
    }
  } else {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_category_select')
      .setPlaceholder('Choose a ticket category')
      .addOptions(categories.map((name, index) => ({
        label: name.slice(0, 100),
        value: String(index),
        description: ('Open a ' + name + ' ticket').slice(0, 100)
      })));
    components.push(new ActionRowBuilder().addComponents(menu));
  }
  await interaction.channel.send({ embeds: [embed], components });
  await replyPrivate(interaction, 'Ticket panel posted using the ' + style + ' layout. The form appears before a ticket channel is created.');
  return true;
}

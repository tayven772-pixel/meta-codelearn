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

const isStaff = (interaction, roleId) =>
  Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    (roleId && interaction.member?.roles?.cache?.has(roleId))
  );

async function replyPrivate(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
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

    setSetting(guildId, 'ticket_category_id', category.id);
    setSetting(guildId, 'ticket_staff_role_id', role.id);
    setSetting(guildId, 'ticket_log_channel_id', logChannel.id);

    return replyPrivate(
      interaction,
      `Ticket settings saved.\nCategory: ${category.name}\nStaff role: ${role.name}\nLog channel: ${logChannel}`
    );
  }

  if (sub === 'panel') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return replyPrivate(interaction, 'Only administrators can post the ticket panel.');
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('Open a Support Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Meta CodeLearn Support')
      .setDescription(
        'Need help with Meta CodeLearn? Click the button below to open a private support ticket. Please do not share passwords or verification codes.'
      );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return replyPrivate(interaction, 'Support ticket panel posted.');
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
    if (!memberOwnsTicket && !staff) {
      return replyPrivate(interaction, 'Only the ticket creator or ticket staff can close this ticket.');
    }
    if (ticket.status === 'closed') return replyPrivate(interaction, 'This ticket is already closed.');

    db.prepare("UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(ticket.id);

    await interaction.channel.permissionOverwrites.edit(ticket.user_id, {
      SendMessages: false
    });

    await interaction.channel.send(`🔒 Ticket closed by ${interaction.user}. Staff can use /ticket reopen to reopen it.`);
    return replyPrivate(interaction, 'Ticket closed.');
  }

  if (sub === 'reopen') {
    if (!staff) return replyPrivate(interaction, 'Only ticket staff can reopen tickets.');
    if (ticket.status === 'open') return replyPrivate(interaction, 'This ticket is already open.');

    db.prepare("UPDATE tickets SET status = 'open', closed_at = NULL WHERE id = ?")
      .run(ticket.id);

    await interaction.channel.permissionOverwrites.edit(ticket.user_id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    await interaction.channel.send(`🔓 Ticket reopened by ${interaction.user}.`);
    return replyPrivate(interaction, 'Ticket reopened.');
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
      await replyPrivate(interaction, 'You already have an open ticket: ' + channel);
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
      content: interaction.user + ' ' + staffRole,
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

    await interaction.editReply('Your private **' + selectedCategory + '** ticket has been created: ' + channel);
    const logChannelId = configured(guildId, 'ticket_log_channel_id');
    const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;
    if (logChannel?.isTextBased()) {
      await logChannel.send('🎫 Ticket #' + insert.lastInsertRowid + ' (' + selectedCategory + ') opened by ' + interaction.user + ' in ' + channel + '.');
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

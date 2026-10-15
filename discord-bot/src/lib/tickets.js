import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
  MessageFlags
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

export async function handleTicketButton(interaction, db) {
  if (interaction.customId !== 'ticket_create') return false;

  const guild = interaction.guild;
  if (!guild) {
    await replyPrivate(interaction, 'Open tickets from inside the server.');
    return true;
  }

  const guildId = guild.id;
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
      await replyPrivate(interaction, `You already have an open ticket: ${channel}`);
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

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const safeName = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40) || 'member';

  let channel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${safeName}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Support ticket opened by ${interaction.user.tag} (${interaction.user.id})`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.AttachFiles
          ]
        }
      ],
      reason: `Support ticket opened by ${interaction.user.tag}`
    });

    const insert = db.prepare(
      'INSERT INTO tickets (guild_id, channel_id, user_id, category) VALUES (?, ?, ?, ?)'
    ).run(guildId, channel.id, interaction.user.id, 'general');

    await channel.send({
      content: `${interaction.user} ${staffRole}`,
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`Support Ticket #${insert.lastInsertRowid}`)
          .setDescription(
            'Please describe the issue you need help with. A staff member will respond here.\n\nNever share passwords, verification codes, or other secrets.'
          )
          .addFields(
            { name: 'Opened by', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: 'Status', value: 'Open' }
          )
      ],
      allowedMentions: { users: [interaction.user.id], roles: [staffRole.id] }
    });

    await interaction.editReply(`Your private ticket has been created: ${channel}`);

    const logChannelId = configured(guildId, 'ticket_log_channel_id');
    const logChannel = logChannelId
      ? await guild.channels.fetch(logChannelId).catch(() => null)
      : null;

    if (logChannel?.isTextBased()) {
      await logChannel.send(`🎫 Ticket #${insert.lastInsertRowid} opened by ${interaction.user} in ${channel}.`);
    }
  } catch (error) {
    if (channel) {
      await channel.delete('Ticket setup failed').catch(() => {});
    }
    console.error('Ticket creation failed:', error.message);
    await interaction.editReply('I could not create your ticket. Please contact a server administrator.').catch(() => {});
  }

  return true;
}

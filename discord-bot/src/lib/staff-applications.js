import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';
import { getSetting, db } from './database.js';

const DEFAULT_QUESTIONS = [
  'Name you would like staff to use',
  'Which role are you applying for?',
  'Why do you want to help Meta Code?',
  'What experience or skills would you bring?',
  'How would you handle a community conflict?'
];

db.exec(`
  CREATE TABLE IF NOT EXISTS staff_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reviewer_id TEXT,
    review_channel_id TEXT,
    review_message_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS staff_applications_status
    ON staff_applications(guild_id, status, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS staff_applications_one_pending_per_user
    ON staff_applications(guild_id, user_id) WHERE status = 'pending';
`);

function questionsFor(guildId) {
  const raw = getSetting(guildId, 'staff_application_questions');
  if (!raw) return DEFAULT_QUESTIONS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 5 &&
        parsed.every(item => typeof item === 'string' && item.trim() && item.length <= 45)) return parsed;
  } catch { /* use safe defaults */ }
  return DEFAULT_QUESTIONS;
}

function isApplicationStaff(interaction, guildId) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roleId = getSetting(guildId, 'staff_application_review_role_id');
  return Boolean(roleId && interaction.member?.roles?.cache?.has(roleId));
}

function clip(value, max = 1000) {
  const text = String(value ?? '').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

export async function postStaffApplicationPanel(interaction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Only server administrators can post the staff application panel.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.channel?.isTextBased() || typeof interaction.channel.send !== 'function') {
    await interaction.reply({ content: 'Run this command in a standard text channel.', flags: MessageFlags.Ephemeral });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x42B883)
    .setTitle('Meta Code | Staff Applications')
    .setDescription(
      'Want to help the Meta Code community? Apply for a volunteer staff role using the button below.\n\n' +
      '**What happens next?**\n' +
      '1. Complete the private application form.\n' +
      '2. The staff team reviews your answers in its private review channel.\n' +
      '3. You receive a direct message when a decision is made.\n\n' +
      'Please answer honestly and respectfully. Do not include passwords, private contact details, or other sensitive information.'
    )
    .setFooter({ text: 'Meta Code • Staff recruitment' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('staff_apply_start').setLabel('Apply for Staff').setEmoji('📋').setStyle(ButtonStyle.Primary)
  );
  await interaction.channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
  await interaction.reply({ content: 'Staff application panel posted. Applications will be sent to the configured private review channel.', flags: MessageFlags.Ephemeral });
}

export async function handleStaffApplicationInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === 'staff_apply_start') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Use this application panel inside the Meta Code server.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const prior = db.prepare("SELECT id FROM staff_applications WHERE guild_id = ? AND user_id = ? AND status = 'pending'").get(interaction.guildId, interaction.user.id);
    if (prior) {
      await interaction.reply({ content: 'You already have an application waiting for review. Please wait for the staff team to contact you.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const questions = questionsFor(interaction.guildId);
    const modal = new ModalBuilder().setCustomId('staff_apply_modal').setTitle('Meta Code Staff Application');
    const rows = questions.map((question, index) => new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('staff_answer_' + index)
        .setLabel(question.slice(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(1)
        .setMaxLength(1000)
        .setRequired(true)
        .setPlaceholder('Write a clear and thoughtful answer')
    ));
    modal.addComponents(...rows);
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'staff_apply_modal') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Submit applications in the Meta Code server.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const questions = questionsFor(interaction.guildId);
    const answers = questions.map((question, index) => ({
      question,
      answer: interaction.fields.getTextInputValue('staff_answer_' + index).trim()
    }));
    if (answers.some(item => !item.answer)) {
      await interaction.reply({ content: 'Please complete every application answer.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const reviewChannelId = getSetting(interaction.guildId, 'staff_application_review_channel_id');
    const reviewChannel = reviewChannelId
      ? await interaction.guild.channels.fetch(reviewChannelId).catch(() => null)
      : interaction.guild.channels.cache.find(channel => channel.name === 'staff-applications' && channel.isTextBased());
    if (!reviewChannel?.isTextBased() || typeof reviewChannel.send !== 'function') {
      await interaction.reply({ content: 'The private staff review channel is not configured. Please contact a server administrator.', flags: MessageFlags.Ephemeral });
      return true;
    }

    let applicationId;
    try {
      const result = db.prepare(
        'INSERT INTO staff_applications (guild_id, user_id, username, answers_json, review_channel_id) VALUES (?, ?, ?, ?, ?)'
      ).run(interaction.guildId, interaction.user.id, interaction.user.tag, JSON.stringify(answers), reviewChannel.id);
      applicationId = Number(result.lastInsertRowid);
    } catch (error) {
      if (String(error?.code || '').includes('CONSTRAINT')) {
        await interaction.reply({ content: 'You already have an application waiting for review.', flags: MessageFlags.Ephemeral });
        return true;
      }
      throw error;
    }

    try {
      const embed = new EmbedBuilder()
        .setColor(0xF0B44C)
        .setTitle('New staff application #' + applicationId)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ size: 128 }) })
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setDescription('Applicant: <@' + interaction.user.id + '>\nStatus: **Pending review**')
        .addFields(answers.map(item => ({ name: clip(item.question, 256), value: clip(item.answer, 1024) || 'No answer provided', inline: false })))
        .setFooter({ text: 'Meta Code • Private staff review' })
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('staff_app_review:approve:' + applicationId).setLabel('Approve').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('staff_app_review:reject:' + applicationId).setLabel('Reject').setStyle(ButtonStyle.Danger)
      );
      const message = await reviewChannel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
      db.prepare('UPDATE staff_applications SET review_message_id = ? WHERE id = ?').run(message.id, applicationId);
    } catch (error) {
      db.prepare('DELETE FROM staff_applications WHERE id = ?').run(applicationId);
      throw new Error('Could not send your application to staff review: ' + error.message);
    }

    await interaction.reply({ content: '✅ Your application has been submitted privately. The staff team will contact you after reviewing it.', flags: MessageFlags.Ephemeral });
    await interaction.user.send('Your Meta Code staff application #' + applicationId + ' was received. The team will message you after a decision.').catch(() => {});
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('staff_app_review:')) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Review applications inside the server.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const [, decision, rawId] = interaction.customId.split(':');
    const applicationId = Number(rawId);
    if (!['approve', 'reject'].includes(decision) || !Number.isSafeInteger(applicationId) || applicationId < 1) {
      await interaction.reply({ content: 'This application review action is invalid.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!isApplicationStaff(interaction, interaction.guildId)) {
      await interaction.reply({ content: 'Only administrators or the configured application review staff can decide applications.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const application = db.prepare('SELECT * FROM staff_applications WHERE id = ? AND guild_id = ?').get(applicationId, interaction.guildId);
    if (!application) {
      await interaction.reply({ content: 'This application could not be found.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (application.status !== 'pending') {
      await interaction.reply({ content: 'This application has already been reviewed as ' + application.status + '.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const status = decision === 'approve' ? 'approved' : 'rejected';
    const result = db.prepare(
      "UPDATE staff_applications SET status = ?, reviewer_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND guild_id = ? AND status = 'pending'"
    ).run(status, interaction.user.id, applicationId, interaction.guildId);
    if (!result.changes) {
      await interaction.reply({ content: 'Another staff member has already reviewed this application.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const original = interaction.message.embeds[0];
    const updated = original ? EmbedBuilder.from(original)
      .setColor(status === 'approved' ? 0x42B883 : 0xD97757)
      .setDescription('Applicant: <@' + application.user_id + '>\nStatus: **' + status.toUpperCase() + '**\nReviewed by: ' + interaction.user.tag)
      .setFooter({ text: 'Meta Code • Application #' + applicationId }) : null;
    await interaction.update({ embeds: updated ? [updated] : interaction.message.embeds, components: [] });

    if (status === 'approved') {
      const approvedRoleId = getSetting(interaction.guildId, 'staff_application_approved_role_id');
      if (approvedRoleId) {
        const member = await interaction.guild.members.fetch(application.user_id).catch(() => null);
        const role = await interaction.guild.roles.fetch(approvedRoleId).catch(() => null);
        const botHighest = interaction.guild.members.me?.roles.highest.position ?? 0;
        if (member && role && !role.managed && role.position < botHighest) {
          await member.roles.add(role, 'Meta Code staff application approved').catch(error => console.error('Could not assign application role:', error.message));
        }
      }
    }

    const applicant = await interaction.client.users.fetch(application.user_id).catch(() => null);
    await applicant?.send('Your Meta Code staff application #' + applicationId + ' has been **' + status + '**.').catch(() => {});
    await interaction.followUp({ content: 'Application #' + applicationId + ' marked ' + status + '.', flags: MessageFlags.Ephemeral });
    return true;
  }

  return false;
}

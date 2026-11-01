import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
  TextInputBuilder, TextInputStyle
} from 'discord.js';
import { db, getSetting, setSetting } from './database.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS staff_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    requested_role TEXT NOT NULL,
    availability TEXT NOT NULL,
    experience TEXT NOT NULL,
    motivation TEXT NOT NULL,
    scenario TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
    reviewer_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS staff_applications_guild_status ON staff_applications(guild_id, status, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS staff_applications_one_pending_per_user
    ON staff_applications(guild_id, user_id) WHERE status = 'pending';
`);

export const staffApplicationCommands = [
  new SlashCommandBuilder()
    .setName('setup-applications')
    .setDescription('Post the staff application panel and choose the private review channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option => option.setName('staff_channel')
      .setDescription('Private channel where completed applications are sent')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
].map(command => command.toJSON());

function isStaffReviewer(interaction) {
  return interaction.inGuild() && (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  );
}

function buildApplicationEmbed(application, guild) {
  return new EmbedBuilder()
    .setColor(application.status === 'accepted' ? 0x2EAD68 : application.status === 'rejected' ? 0xC94C4C : 0x5865F2)
    .setTitle('Staff application #' + application.id)
    .setAuthor({ name: application.username, iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png' })
    .setDescription('Applicant: <@' + application.user_id + '>\nStatus: **' + application.status.toUpperCase() + '**')
    .addFields(
      { name: 'Role requested', value: application.requested_role.slice(0, 300), inline: true },
      { name: 'Availability', value: application.availability.slice(0, 500), inline: false },
      { name: 'Relevant experience', value: application.experience.slice(0, 900), inline: false },
      { name: 'Why Meta Code?', value: application.motivation.slice(0, 900), inline: false },
      { name: 'Scenario response', value: application.scenario.slice(0, 900), inline: false }
    )
    .setFooter({ text: guild.name + ' • Meta Code staff recruitment' })
    .setTimestamp(new Date(application.created_at + ' UTC'));
}

function reviewButtons(id, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('staff_application_accept_' + id).setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('staff_application_reject_' + id).setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(disabled)
  );
}

export async function handleStaffApplicationCommand(interaction) {
  if (interaction.commandName !== 'setup-applications') return false;
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Only server administrators can configure staff applications.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const staffChannel = interaction.options.getChannel('staff_channel', true);
  if (!staffChannel?.isTextBased() || !staffChannel.send) {
    await interaction.reply({ content: 'Choose a regular text channel for staff application reviews.', flags: MessageFlags.Ephemeral });
    return true;
  }
  setSetting(interaction.guildId, 'staff_applications_channel_id', staffChannel.id);
  setSetting(interaction.guildId, 'staff_applications_enabled', 'true');
  const title = getSetting(interaction.guildId, 'staff_applications_title') || 'Meta Code | Staff Applications';
  const description = getSetting(interaction.guildId, 'staff_applications_description') ||
    'Help make Meta Code a welcoming place to learn and build. Apply privately using the button below. Applications are sent to the configured staff review channel.';
  const embed = new EmbedBuilder().setColor(0x42B883).setTitle(title.slice(0, 256))
    .setDescription(description.slice(0, 4000))
    .setThumbnail(interaction.guild.iconURL({ size: 256 }) || null)
    .setFooter({ text: 'Meta Code • Staff recruitment' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('staff_apply_start').setLabel('Apply for Staff').setEmoji('📋').setStyle(ButtonStyle.Primary)
  );
  await interaction.channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
  await interaction.reply({ content: 'Staff application panel posted. Completed applications will be sent to ' + staffChannel.toString() + '.', flags: MessageFlags.Ephemeral });
  return true;
}

export async function handleStaffApplicationComponent(interaction) {
  if (interaction.isButton() && interaction.customId === 'staff_apply_start') {
    if (getSetting(interaction.guildId, 'staff_applications_enabled') === 'false') {
      await interaction.reply({ content: 'Staff applications are currently closed.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const modal = new ModalBuilder().setCustomId('staff_apply_submit').setTitle('Meta Code Staff Application');
    const fields = [
      ['requested_role', 'Which role are you applying for?', TextInputStyle.Short, 80],
      ['availability', 'What days/times can you help?', TextInputStyle.Short, 180],
      ['experience', 'What relevant experience or skills do you have?', TextInputStyle.Paragraph, 600],
      ['motivation', 'Why would you like to help Meta Code?', TextInputStyle.Paragraph, 600],
      ['scenario', 'How would you handle a disagreement between members?', TextInputStyle.Paragraph, 600]
    ].map(([id, label, style, maxLength]) => new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true).setMaxLength(maxLength)
        .setPlaceholder(id === 'requested_role' ? 'Moderator, Support Team, Coding Helper…' : 'Write a clear, thoughtful answer')
    ));
    modal.addComponents(...fields);
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'staff_apply_submit') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Submit the application from the Meta Code Discord server.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const staffChannelId = getSetting(interaction.guildId, 'staff_applications_channel_id');
    const staffChannel = staffChannelId ? await interaction.guild.channels.fetch(staffChannelId).catch(() => null) : null;
    if (!staffChannel?.isTextBased() || !staffChannel.send) {
      await interaction.reply({ content: 'Applications are not fully configured yet. Please contact a server administrator.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const alreadyPending = db.prepare("SELECT id FROM staff_applications WHERE guild_id = ? AND user_id = ? AND status = 'pending'")
      .get(interaction.guildId, interaction.user.id);
    if (alreadyPending) {
      await interaction.reply({ content: 'You already have a pending staff application (#' + alreadyPending.id + '). Please wait for the team to review it.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const application = {
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      username: interaction.user.tag || interaction.user.username,
      requested_role: interaction.fields.getTextInputValue('requested_role').trim(),
      availability: interaction.fields.getTextInputValue('availability').trim(),
      experience: interaction.fields.getTextInputValue('experience').trim(),
      motivation: interaction.fields.getTextInputValue('motivation').trim(),
      scenario: interaction.fields.getTextInputValue('scenario').trim()
    };
    if (Object.entries(application).some(([key, value]) => key !== 'guild_id' && key !== 'user_id' && key !== 'username' && !value)) {
      await interaction.reply({ content: 'Please complete every field before submitting.', flags: MessageFlags.Ephemeral });
      return true;
    }
    let id;
    try {
      const inserted = db.prepare(`INSERT INTO staff_applications
        (guild_id, user_id, username, requested_role, availability, experience, motivation, scenario)
        VALUES (@guild_id, @user_id, @username, @requested_role, @availability, @experience, @motivation, @scenario)`).run(application);
      id = Number(inserted.lastInsertRowid);
    } catch (error) {
      if (String(error.code || '').includes('CONSTRAINT')) {
        await interaction.reply({ content: 'You already have a pending application. Please wait for the team to review it.', flags: MessageFlags.Ephemeral });
        return true;
      }
      throw error;
    }
    const saved = db.prepare('SELECT * FROM staff_applications WHERE id = ?').get(id);
    try {
      await staffChannel.send({ embeds: [buildApplicationEmbed(saved, interaction.guild)], components: [reviewButtons(id)], allowedMentions: { parse: [] } });
    } catch (error) {
      db.prepare("UPDATE staff_applications SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      throw new Error('The application could not be delivered to the staff channel. Ask an administrator to check bot permissions. ' + error.message);
    }
    await interaction.reply({ content: 'Your staff application was submitted successfully. The team will review it and contact you through Discord.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton() && /^staff_application_(accept|reject)_\d+$/.test(interaction.customId)) {
    if (!isStaffReviewer(interaction)) {
      await interaction.reply({ content: 'You need Manage Server or Administrator permission to review applications.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const [, decision, rawId] = interaction.customId.match(/^staff_application_(accept|reject)_(\d+)$/);
    const id = Number(rawId);
    const application = db.prepare("SELECT * FROM staff_applications WHERE id = ? AND guild_id = ? AND status = 'pending'").get(id, interaction.guildId);
    if (!application) {
      await interaction.reply({ content: 'This application has already been reviewed or could not be found.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const status = decision === 'accept' ? 'accepted' : 'rejected';
    const update = db.prepare("UPDATE staff_applications SET status = ?, reviewer_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
      .run(status, interaction.user.id, id);
    if (!update.changes) {
      await interaction.reply({ content: 'Another reviewer already handled this application.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const updated = db.prepare('SELECT * FROM staff_applications WHERE id = ?').get(id);
    await interaction.update({ embeds: [buildApplicationEmbed(updated, interaction.guild)], components: [] });
    const dm = status === 'accepted'
      ? 'Your Meta Code staff application was accepted. A staff member will contact you with next steps.'
      : 'Thank you for applying to the Meta Code staff team. Your application was not accepted this time.';
    const applicant = await interaction.client.users.fetch(application.user_id).catch(() => null);
    if (applicant) await applicant.send({ content: dm }).catch(() => {});
    return true;
  }
  return false;
}

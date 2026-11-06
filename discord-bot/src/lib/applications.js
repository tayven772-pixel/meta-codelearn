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
    avatar_url TEXT NOT NULL DEFAULT '',
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
try { db.exec("ALTER TABLE staff_applications ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''"); } catch (error) { if (!String(error.message).includes('duplicate column name')) throw error; }

export const staffApplicationCommands = [
  new SlashCommandBuilder()
    .setName('setup-applications')
    .setDescription('Publish the staff application panel using a private review channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option => option.setName('staff_channel')
      .setDescription('Private channel where completed applications are sent')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
  new SlashCommandBuilder().setName('application-question').setDescription('Edit application question wording and minimum word count').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('number').setDescription('Question number 1–5').setMinValue(1).setMaxValue(5).setRequired(true))
    .addStringOption(o => o.setName('question').setDescription('New question wording (optional)').setMaxLength(350).setRequired(false))
    .addIntegerOption(o => o.setName('minimum_words').setDescription('Minimum words (0 disables)').setMinValue(0).setMaxValue(500).setRequired(false)),
].map(command => command.toJSON());

async function isStaffReviewer(interaction) {
  if (!interaction.inGuild()) return false;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roleId = getSetting(interaction.guildId, 'staff_applications_role_id');
  if (!roleId) return false;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  return Boolean(member?.roles.cache.has(roleId));
}

function buildApplicationEmbed(application, guild) {
  return new EmbedBuilder()
    .setColor(application.status === 'accepted' ? 0x2EAD68 : application.status === 'rejected' ? 0xC94C4C : 0x5865F2)
    .setTitle('Staff application #' + application.id)
    .setAuthor({ name: application.username, iconURL: application.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png' })
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
    new ButtonBuilder().setCustomId('staff_application_reject_' + id).setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId('staff_application_followup_' + id).setLabel('Follow up').setStyle(ButtonStyle.Secondary).setEmoji('📩').setDisabled(disabled)
  );
}

export async function handleStaffApplicationCommand(interaction) {
  if (interaction.commandName === 'application-question') {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: 'Only administrators can edit application questions.', flags: MessageFlags.Ephemeral }); return true; }
    const n = interaction.options.getInteger('number', true);
    const q = interaction.options.getString('question');
    const min = interaction.options.getInteger('minimum_words');
    if (q?.trim()) setSetting('global', 'staff_application_question_' + n, q.trim());
    if (min !== null) setSetting('global', 'staff_application_min_words_' + n, String(min));
    const defaults = ['Which staff role are you applying for?', 'What days and times are you available to help?', 'What skills or experience would you bring?', 'Why would you like to help Meta Code?', 'How would you handle a disagreement between members?'];
    await interaction.reply({ content: 'Saved question ' + n + ': ' + (getSetting(interaction.guildId, 'staff_application_question_' + n) || defaults[n - 1]) + '\nMinimum words: ' + (getSetting(interaction.guildId, 'staff_application_min_words_' + n) || '0'), flags: MessageFlags.Ephemeral });
    return true;
  }
  if (interaction.commandName !== 'setup-applications') return false;
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Only server administrators can configure staff applications.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const configuredChannelId = getSetting(interaction.guildId, 'staff_applications_channel_id');
  const staffChannel = interaction.options.getChannel('staff_channel') ||
    (configuredChannelId ? await interaction.guild.channels.fetch(configuredChannelId).catch(() => null) : null);
  if (!staffChannel?.isTextBased() || !staffChannel.send) {
    await interaction.reply({ content: 'Choose a text channel or configure settings.applications.staffChannel in the JSON template first.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const everyonePermissions = staffChannel.permissionsFor(interaction.guild.roles.everyone);
  if (!everyonePermissions || everyonePermissions.has(PermissionFlagsBits.ViewChannel)) {
    await interaction.reply({ content: 'The application review channel must be private. Deny View Channel to @everyone, grant access to your staff role, and run the command again.', flags: MessageFlags.Ephemeral });
    return true;
  }
  setSetting('global', 'staff_applications_channel_id', staffChannel.id);
  if (getSetting(interaction.guildId, 'staff_applications_enabled') === null) {
    setSetting('global', 'staff_applications_enabled', 'true');
  }
  if (!interaction.channel?.isTextBased() || !interaction.channel.send) {
    await interaction.reply({ content: 'Run this command in a text channel where Meta can post the application panel.', flags: MessageFlags.Ephemeral });
    return true;
  }
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

const activeApplicationDMs = new Set();
const APPLICATION_EMBED_COLOR = 0x5865F2;
function applicationDMEmbed(title, description, color = APPLICATION_EMBED_COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Meta Code • Staff Applications' })
    .setTimestamp();
}
async function sendApplicationDM(dm, title, description, color) {
  return dm.send({ embeds: [applicationDMEmbed(title, description, color)] });
}

async function collectStaffApplicationByDM(interaction, dm, staffChannel) {
  const defaultPrompts = [
    ['requested_role', 'Which staff role are you applying for?', 80],
    ['availability', 'What days and times are you available to help?', 180],
    ['experience', 'What skills or experience would you bring?', 600],
    ['motivation', 'Why would you like to help Meta Code?', 600],
    ['scenario', 'How would you handle a disagreement between members?', 600]
  ];
  const prompts = defaultPrompts.map(([key, question, maxLength], index) => [
    key, (index + 1) + '/5 — ' + (getSetting(interaction.guildId, 'staff_application_question_' + (index + 1)) || question) + ' (' + maxLength + ' characters max)', maxLength
  ]);
  const answers = {};
  try {
    for (const [key, prompt, maxLength] of prompts) {
      await sendApplicationDM(dm, prompt, 'Reply to this message with your answer. Send **cancel** at any time to stop.');
      const collected = await dm.awaitMessages({
        filter: message => message.author.id === interaction.user.id && !message.author.bot,
        max: 1,
        time: 5 * 60 * 1000,
        errors: ['time']
      });
      const answer = collected.first()?.content?.trim() || '';
      if (answer.toLowerCase() === 'cancel') {
        await sendApplicationDM(dm, 'Application cancelled', 'Your Meta Code staff application was cancelled.', 0xED4245);
        return;
      }
      const questionNumber = prompts.findIndex(item => item[0] === key) + 1;
      const minimumWords = Number(getSetting(interaction.guildId, 'staff_application_min_words_' + questionNumber) || 0);
      const wordCount = answer.split(/\\s+/).filter(Boolean).length;
      if (minimumWords > 0 && wordCount < minimumWords) {
        await sendApplicationDM(dm, 'Answer too short', 'Question ' + questionNumber + ' requires at least ' + minimumWords + ' words. Your answer has ' + wordCount + '. Please restart the application and try again.', 0xED4245);
        return;
      }
      if (!answer || answer.length > maxLength) {
        await sendApplicationDM(dm, 'Answer not accepted', 'Your answer must be between 1 and ' + maxLength + ' characters. Please start again by clicking **Apply for Staff** in the server.', 0xED4245);
        return;
      }
      answers[key] = answer;
    }

    await sendApplicationDM(dm, 'Review your answers', 'You can edit answers before sending. Reply with edit 1, edit 2, ... edit 5 to change one, or submit to send your application.');
    let reviewing = true;
    while (reviewing) {
      const review = await dm.awaitMessages({ filter: message => message.author.id === interaction.user.id && !message.author.bot, max: 1, time: 5 * 60 * 1000, errors: ['time'] });
      const text = review.first()?.content?.trim() || '';
      if (text.toLowerCase() === 'submit') { reviewing = false; break; }
      const match = text.match(/^edit\\s+([1-5])$/i);
      if (!match) { await sendApplicationDM(dm, 'Review answers', 'Use edit 1–5 to revise an answer, or submit to send.'); continue; }
      const index = Number(match[1]) - 1;
      await sendApplicationDM(dm, 'Edit answer ' + (index + 1), 'Send the replacement answer in your next message.');
      const replacementMessages = await dm.awaitMessages({ filter: message => message.author.id === interaction.user.id && !message.author.bot, max: 1, time: 5 * 60 * 1000, errors: ['time'] });
      const replacement = replacementMessages.first()?.content?.trim() || '';
      const minWords = Number(getSetting(interaction.guildId, 'staff_application_min_words_' + (index + 1)) || 0);
      const count = replacement.split(/\\s+/).filter(Boolean).length;
      if (!replacement || replacement.length > prompts[index][2] || count < minWords) { await sendApplicationDM(dm, 'Answer not accepted', 'Your answer must be within ' + prompts[index][2] + ' characters and contain at least ' + minWords + ' words. Please try again.'); continue; }
      answers[prompts[index][0]] = replacement;
      await sendApplicationDM(dm, 'Answer updated', 'Saved your revised answer. You can edit another answer or send submit.');
    }
    const existing = db.prepare("SELECT id FROM staff_applications WHERE guild_id = ? AND user_id = ? AND status = 'pending'")
      .get(interaction.guildId, interaction.user.id);
    if (existing) {
      await sendApplicationDM(dm, 'Application already pending', 'You already have a pending application (#' + existing.id + '). Please wait for the team to review it.');
      return;
    }

    const application = {
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      username: interaction.user.tag || interaction.user.username,
      avatar_url: interaction.user.displayAvatarURL({ size: 256, extension: 'png' }),
      ...answers
    };
    const inserted = db.prepare(`INSERT INTO staff_applications
      (guild_id, user_id, username, avatar_url, requested_role, availability, experience, motivation, scenario)
      VALUES (@guild_id, @user_id, @username, @avatar_url, @requested_role, @availability, @experience, @motivation, @scenario)`).run(application);
    const id = Number(inserted.lastInsertRowid);
    const saved = db.prepare('SELECT * FROM staff_applications WHERE id = ?').get(id);
    try {
      await staffChannel.send({ embeds: [buildApplicationEmbed(saved, interaction.guild)], components: [reviewButtons(id)], allowedMentions: { parse: [] } });
    } catch (error) {
      db.prepare("UPDATE staff_applications SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      throw error;
    }
    await sendApplicationDM(dm, 'Application submitted', '✅ Your Meta Code staff application was submitted successfully. The team will review it.', 0x57F287);
  } catch (error) {
    if (error?.code === 'CollectorTimeout') {
      await sendApplicationDM(dm, 'Application timed out', 'No answer was received within 5 minutes. Click **Apply for Staff** to start again.', 0xED4245).catch(() => {});
    } else {
      console.error('[Applications] DM application failed:', error?.message || error);
      await sendApplicationDM(dm, 'Application error', 'I could not complete your application. Please contact a server administrator.', 0xED4245).catch(() => {});
    }
  } finally {
    activeApplicationDMs.delete(interaction.user.id);
  }
}

export async function handleStaffApplicationComponent(interaction) {
  if (interaction.isButton() && interaction.customId === 'staff_apply_start') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Please start your application from the Meta Code server.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (getSetting(interaction.guildId, 'staff_applications_enabled') === 'false') {
      await interaction.reply({ content: 'Staff applications are currently closed.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (activeApplicationDMs.has(interaction.user.id)) {
      await interaction.reply({ content: 'You already have an application conversation open in your DMs.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const staffChannelId = getSetting(interaction.guildId, 'staff_applications_channel_id');
    const staffChannel = staffChannelId ? await interaction.guild.channels.fetch(staffChannelId).catch(() => null) : null;
    if (!staffChannel?.isTextBased() || !staffChannel.send) {
      await interaction.reply({ content: 'Applications are not configured yet. Please contact a server administrator.', flags: MessageFlags.Ephemeral });
      return true;
    }
    let dm;
    try {
      dm = await interaction.user.createDM();
      await dm.send('👋 Welcome to the Meta Code staff application! I’ll ask you 5 questions here in private. You have 5 minutes to answer each question. Send **cancel** at any time to stop.');
    } catch {
      await interaction.reply({ content: 'I could not DM you. Please enable direct messages from this server, then click Apply for Staff again.', flags: MessageFlags.Ephemeral });
      return true;
    }
    activeApplicationDMs.add(interaction.user.id);
    await interaction.reply({ content: '📩 I sent you a DM to complete your staff application. Check your Discord messages!', flags: MessageFlags.Ephemeral });
    void collectStaffApplicationByDM(interaction, dm, staffChannel);
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
      avatar_url: interaction.user.displayAvatarURL({ size: 256, extension: 'png' }),
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
        (guild_id, user_id, username, avatar_url, requested_role, availability, experience, motivation, scenario)
        VALUES (@guild_id, @user_id, @username, @avatar_url, @requested_role, @availability, @experience, @motivation, @scenario)`).run(application);
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
    if (!(await isStaffReviewer(interaction))) {
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

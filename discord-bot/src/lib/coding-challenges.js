import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { db } from './database.js';
import {
  CODING_CHALLENGE_XP,
  getCodingChallengeStreak,
  getDailyCodingChallenge,
  isCorrectChallengeAnswer,
} from './coding-challenge-core.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS community_xp (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, xp INTEGER NOT NULL DEFAULT 0,
    messages INTEGER NOT NULL DEFAULT 0, last_message_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS coding_challenge_completions (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    challenge_day TEXT NOT NULL,
    challenge_number INTEGER NOT NULL,
    solved_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, challenge_day)
  );
  CREATE INDEX IF NOT EXISTS coding_challenge_user_history
    ON coding_challenge_completions (guild_id, user_id, challenge_day);
`);

const recordCompletion = db.prepare(`
  INSERT OR IGNORE INTO coding_challenge_completions
    (guild_id, user_id, challenge_day, challenge_number, solved_at)
  VALUES (?, ?, ?, ?, ?)
`);

const awardXp = db.prepare(`
  INSERT INTO community_xp (guild_id, user_id, xp, messages, last_message_at)
  VALUES (?, ?, ?, 0, 0)
  ON CONFLICT (guild_id, user_id)
  DO UPDATE SET xp = community_xp.xp + excluded.xp
`);

const completeChallenge = db.transaction((guildId, userId, challenge, solvedAt) => {
  const result = recordCompletion.run(
    guildId,
    userId,
    challenge.day,
    challenge.number,
    solvedAt,
  );
  if (result.changes !== 1) return false;

  awardXp.run(guildId, userId, CODING_CHALLENGE_XP);
  return true;
});

export const codingChallengeCommand = new SlashCommandBuilder()
  .setName('challenge')
  .setDescription('Try the daily Meta CodeLearn coding challenge')
  .addSubcommand(subcommand =>
    subcommand.setName('today').setDescription('Post today’s coding prompt in this channel'))
  .addSubcommand(subcommand =>
    subcommand.setName('answer').setDescription('Submit your answer privately')
      .addStringOption(option =>
        option.setName('answer').setDescription('Your answer').setMaxLength(120).setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand.setName('hint').setDescription('Get a private hint for today’s challenge'))
  .addSubcommand(subcommand =>
    subcommand.setName('stats').setDescription('View solved challenges and your streak')
      .addUserOption(option =>
        option.setName('user').setDescription('Member to check (defaults to you)').setRequired(false)));

export async function handleCodingChallengeCommand(interaction, now = new Date()) {
  if (interaction.commandName !== 'challenge') return false;
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'Use coding challenges inside a server.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const challenge = getDailyCodingChallenge(now);
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'today') {
    const embed = new EmbedBuilder()
      .setColor(0x42B883)
      .setTitle(`Daily coding challenge · #${challenge.number}`)
      .setDescription(
        `**${challenge.language}** · ${challenge.day} UTC\n\n${challenge.question}\n\n` +
        'Submit privately with `/challenge answer`, or ask for `/challenge hint`.',
      )
      .setFooter({ text: `A new prompt rotates daily at 00:00 UTC · Correct answers earn ${CODING_CHALLENGE_XP} XP once per day` });

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    return true;
  }

  if (subcommand === 'hint') {
    await interaction.reply({
      content: `**${challenge.language} hint:** ${challenge.hint}`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (subcommand === 'answer') {
    const answer = interaction.options.getString('answer', true);
    if (!isCorrectChallengeAnswer(answer, challenge.answers)) {
      await interaction.reply({
        content: 'Not quite. No points are lost—try again or use `/challenge hint`.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const recorded = completeChallenge(
      interaction.guildId,
      interaction.user.id,
      challenge,
      now.getTime(),
    );
    await interaction.reply({
      content: recorded
        ? `Correct! You earned ${CODING_CHALLENGE_XP} XP. Check your updated profile with \`/level\`.`
        : 'You already solved today’s challenge. The daily XP reward can only be earned once.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (subcommand === 'stats') {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const completions = db.prepare(`
      SELECT challenge_day
      FROM coding_challenge_completions
      WHERE guild_id = ? AND user_id = ?
      ORDER BY challenge_day DESC
    `).all(interaction.guildId, user.id);
    const streak = getCodingChallengeStreak(
      completions.map(completion => completion.challenge_day),
      challenge.day,
    );
    const embed = new EmbedBuilder()
      .setColor(0x42B883)
      .setTitle(`${user.username}’s coding challenge stats`)
      .addFields(
        { name: 'Solved', value: String(completions.length), inline: true },
        { name: 'Current streak', value: `${streak} day${streak === 1 ? '' : 's'}`, inline: true },
      )
      .setFooter({ text: 'Challenge days use UTC.' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  await interaction.reply({
    content: 'Choose `today`, `answer`, `hint`, or `stats`.',
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCodingChallengeStreak,
  getDailyCodingChallenge,
  isCorrectChallengeAnswer,
  normalizeChallengeAnswer,
} from '../src/lib/coding-challenge-core.js';

test('the daily challenge stays stable throughout a UTC day', () => {
  const morning = getDailyCodingChallenge('2026-11-01T01:00:00.000Z');
  const evening = getDailyCodingChallenge('2026-11-01T23:59:59.000Z');

  assert.equal(morning.day, '2026-11-01');
  assert.equal(morning.number, evening.number);
  assert.equal(morning.question, evening.question);
});

test('the challenge rotates at the next UTC day', () => {
  const today = getDailyCodingChallenge('2026-11-01T23:59:59.000Z');
  const tomorrow = getDailyCodingChallenge('2026-11-02T00:00:00.000Z');

  assert.notEqual(today.number, tomorrow.number);
  assert.notEqual(today.question, tomorrow.question);
});

test('answer matching ignores case, surrounding whitespace, and code fences', () => {
  assert.equal(normalizeChallengeAnswer('  ```JS\nGit Status\n```  '), 'git status');
  assert.equal(isCorrectChallengeAnswer('  ```JS\nGit Status\n```  ', ['git status']), true);
});

test('answer matching supports equivalent accepted forms', () => {
  assert.equal(isCorrectChallengeAnswer('DISPLAY:   FLEX', ['flex', 'display: flex']), true);
  assert.equal(isCorrectChallengeAnswer('not the answer', ['flex', 'display: flex']), false);
  assert.equal(isCorrectChallengeAnswer('   ', ['anything']), false);
});

test('current streak counts consecutive completed UTC days', () => {
  assert.equal(
    getCodingChallengeStreak(['2026-11-01', '2026-10-31', '2026-10-30'], '2026-11-01'),
    3,
  );
});

test('a streak remains current through yesterday but resets after a gap', () => {
  assert.equal(
    getCodingChallengeStreak(['2026-10-31', '2026-10-30'], '2026-11-01'),
    2,
  );
  assert.equal(
    getCodingChallengeStreak(['2026-10-29', '2026-10-27'], '2026-11-01'),
    0,
  );
});

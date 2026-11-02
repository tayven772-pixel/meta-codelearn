const DAY_MS = 24 * 60 * 60 * 1000;

const challengeBank = [
  {
    language: 'JavaScript',
    question: 'What does `2 + "2"` evaluate to?',
    hint: 'When one operand is a string, the `+` operator joins text.',
    answers: ['22'],
  },
  {
    language: 'Python',
    question: 'What is the result of `7 // 2`?',
    hint: 'The double slash performs floor division.',
    answers: ['3'],
  },
  {
    language: 'CSS',
    question: 'Which property sets the color of text?',
    hint: 'It is a one-word property often paired with `background-color`.',
    answers: ['color'],
  },
  {
    language: 'HTML',
    question: 'Which image attribute provides alternative text?',
    hint: 'It is a short, two-letter attribute name.',
    answers: ['alt'],
  },
  {
    language: 'JavaScript',
    question: 'What does `typeof []` return?',
    hint: 'Arrays are objects in JavaScript.',
    answers: ['object'],
  },
  {
    language: 'Git',
    question: 'Which command stages all changed, added, and deleted files?',
    hint: 'Use `git add` with the all-changes flag.',
    answers: ['git add -a', 'git add --all'],
  },
  {
    language: 'Python',
    question: 'Which built-in function returns the length of a list?',
    hint: 'It is a three-letter function.',
    answers: ['len'],
  },
  {
    language: 'SQL',
    question: 'Which two-word clause sorts query results?',
    hint: 'It comes after `WHERE` and before `LIMIT`.',
    answers: ['order by'],
  },
  {
    language: 'JavaScript',
    question: 'What is the value of `["red", "blue"][1]`?',
    hint: 'Array indexes start at zero.',
    answers: ['blue'],
  },
  {
    language: 'HTML',
    question: 'What is the element name used to create a hyperlink?',
    hint: 'It is the first letter of “anchor.”',
    answers: ['a', 'anchor', '<a>'],
  },
  {
    language: 'Python',
    question: 'What does `bool(0)` return?',
    hint: 'Zero is a falsey value in Python.',
    answers: ['false'],
  },
  {
    language: 'CSS',
    question: 'What `display` value makes an element a flex container?',
    hint: 'The value is the name of the layout model.',
    answers: ['flex', 'display: flex'],
  },
  {
    language: 'JavaScript',
    question: 'Which operator checks strict equality?',
    hint: 'It uses three equals signs.',
    answers: ['==='],
  },
  {
    language: 'Git',
    question: 'Which command shows changed files and the current branch?',
    hint: 'It is the first command many people run before committing.',
    answers: ['git status'],
  },
  {
    language: 'Python',
    question: 'Which keyword begins a function definition?',
    hint: 'It is short for “define.”',
    answers: ['def'],
  },
  {
    language: 'JavaScript',
    question: 'Which array method adds an item to the end?',
    hint: 'It “pushes” a new item onto the array.',
    answers: ['push', 'push()'],
  },
];

export const CODING_CHALLENGE_XP = 25;

export function normalizeChallengeAnswer(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/^```[a-z0-9_-]*\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^`|`$/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

export function isCorrectChallengeAnswer(value, acceptedAnswers) {
  const answer = normalizeChallengeAnswer(value);
  if (!answer) return false;
  return acceptedAnswers.some(candidate => normalizeChallengeAnswer(candidate) === answer);
}

export function getDailyCodingChallenge(now = new Date()) {
  const instant = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError('A valid date is required to select the daily challenge.');
  }

  const day = instant.toISOString().slice(0, 10);
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00.000Z`) / DAY_MS);
  const index = ((dayNumber % challengeBank.length) + challengeBank.length) % challengeBank.length;

  return {
    day,
    number: index + 1,
    ...challengeBank[index],
  };
}

function shiftUtcDay(day, offset) {
  const timestamp = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + offset * DAY_MS).toISOString().slice(0, 10);
}

export function getCodingChallengeStreak(completedDays, today) {
  const completed = new Set(completedDays);
  let day = completed.has(today) ? today : shiftUtcDay(today, -1);
  let streak = 0;

  while (day && completed.has(day)) {
    streak += 1;
    day = shiftUtcDay(day, -1);
  }

  return streak;
}

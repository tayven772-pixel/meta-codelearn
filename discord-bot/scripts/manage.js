import {
  getSetting,
  setSetting,
  getSettings,
  getQuestions,
  addQuestion,
  closeDatabase
} from '../src/lib/database.js';

const [action, guildId, key, ...rest] = process.argv.slice(2);

function usage() {
  console.log(`
Meta CodeLearn Bot Manager

Commands:
  npm run manage -- settings <SERVER_ID>
  npm run manage -- get <SERVER_ID> <SETTING_KEY>
  npm run manage -- set <SERVER_ID> <SETTING_KEY> <VALUE>
  npm run manage -- questions <SERVER_ID>
  npm run manage -- add-question <SERVER_ID> "Question text"
`);
}

try {
  if (!action || !guildId || action === 'help') {
    usage();
    process.exitCode = action === 'help' ? 0 : 1;
  } else if (!/^\d{17,20}$/.test(guildId)) {
    throw new Error('SERVER_ID must be a Discord server ID (17–20 digits).');
  } else if (action === 'settings') {
    const rows = getSettings(guildId);
    if (!rows.length) console.log('No settings saved for this server yet.');
    else for (const row of rows) {
      console.log(`${row.setting_key}=${row.setting_value}`);
    }
  } else if (action === 'get') {
    if (!key) throw new Error('Provide a setting key.');
    const value = getSetting(guildId, key);
    console.log(value === null ? 'Setting not found.' : value);
  } else if (action === 'set') {
    const value = rest.join(' ').trim();
    if (!key || !value) throw new Error('Provide a setting key and value.');
    if (/token|password|secret|app.?key|credential/i.test(key)) {
      throw new Error('Sensitive credentials must not be stored in bot settings.');
    }
    setSetting(guildId, key, value);
    console.log(`Saved setting: ${key}`);
  } else if (action === 'questions') {
    const questions = getQuestions(guildId);
    if (!questions.length) console.log('No application questions configured yet.');
    else for (const q of questions) {
      console.log(`${q.position}. ${q.enabled ? '[enabled]' : '[disabled]'} ${q.question}`);
    }
  } else if (action === 'add-question') {
    const question = [key, ...rest].filter(Boolean).join(' ').trim();
    if (!question) throw new Error('Provide the question text in quotes.');
    if (question.length > 1000) throw new Error('Question must be 1000 characters or fewer.');
    const id = addQuestion(guildId, question);
    console.log(`Added application question ${id}.`);
  } else {
    usage();
    throw new Error(`Unknown action: ${action}`);
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  closeDatabase();
}

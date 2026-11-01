import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChannelName, validateServerTemplate } from '../src/lib/server-setup.js';

const validTemplate = () => ({
  roles: [
    { name: 'Founder', color: 0xF4C95D },
    { name: 'Moderator', color: 0x70C7A1 }
  ],
  categories: [
    { name: 'GET STARTED', channels: [['text', 'welcome'], ['text', 'rules']] },
    { name: 'STAFF HQ', private: true, channels: [['text', 'staff-applications']] },
    { name: 'PARTNERSHIPS', channels: [['text', 'partner-announcements']] },
    { name: 'VOICE LOUNGE', channels: [['voice', 'Community Lounge']] }
  ],
  controlPanel: {
    title: 'Meta Code bot control',
    description: 'Owner dashboard',
    sections: ['setup', 'commands', 'applications']
  },
  settings: {
    welcome: { enabled: true, channel: 'welcome', message: 'Welcome {user}', showAvatar: true },
    autopartner: { enabled: false, channel: 'partner-announcements', intervalHours: 24, minimumMembers: 100 },
    applications: { enabled: true, staffChannel: 'staff-applications', staffRole: 'Moderator', panelTitle: 'Meta Code | Staff Applications' },
    tickets: { category: 'STAFF HQ', panelTitle: 'Support' }
  }
});

test('normalizes channel names consistently', () => {
  assert.equal(normalizeChannelName('  Community Lounge  '), 'community-lounge');
  assert.equal(normalizeChannelName('✨'), 'new-channel');
});

test('accepts the documented JSON schema and connected settings', () => {
  assert.doesNotThrow(() => validateServerTemplate(validTemplate()));
});

test('rejects a repeated role name', () => {
  const template = validTemplate();
  template.roles.push({ name: 'moderator', color: 0xFFFFFF });
  assert.throws(() => validateServerTemplate(template), /Role names must be unique/);
});

test('rejects duplicate channel names after normalization', () => {
  const template = validTemplate();
  template.categories[1].channels.push(['text', 'welcome']);
  assert.throws(() => validateServerTemplate(template), /Channel names must be unique/);
});

test('rejects a settings channel that is not in the template', () => {
  const template = validTemplate();
  template.settings.welcome.channel = 'not-in-template';
  assert.throws(() => validateServerTemplate(template), /must reference a text channel/);
});

test('rejects an application review destination that is a voice channel', () => {
  const template = validTemplate();
  template.settings.applications.staffChannel = 'Community Lounge';
  assert.throws(() => validateServerTemplate(template), /must reference a text channel/);
});

test('rejects unknown dashboard sections', () => {
  const template = validTemplate();
  template.controlPanel.sections.push('delete-everything');
  assert.throws(() => validateServerTemplate(template), /controlPanel/);
});

test('rejects a malformed role color', () => {
  const template = validTemplate();
  template.roles[0].color = -1;
  assert.throws(() => validateServerTemplate(template), /Invalid template structure/);
});

test('rejects an application reviewer role that is not defined in roles', () => {
  const template = validTemplate();
  template.settings.applications.staffRole = 'Unknown Role';
  assert.throws(() => validateServerTemplate(template), /staffRole/);
});

test('rejects the Discord-managed everyone role', () => {
  const template = validTemplate();
  template.roles.push({ name: '@everyone', color: 0xFFFFFF });
  assert.throws(() => validateServerTemplate(template), /@everyone/);
});

test('rejects an unsafe autopartner threshold', () => {
  const template = validTemplate();
  template.settings.autopartner.minimumMembers = 0;
  assert.throws(() => validateServerTemplate(template), /minimumMembers/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { ensureStaffRolePingable } from '../src/lib/tickets.js';

test('staff role already mentionable can be pinged without changing it', async () => {
  let changed = false;
  const role = {
    mentionable: true,
    editable: false,
    setMentionable: async () => { changed = true; }
  };
  const guild = { members: { me: { permissions: { has: () => false } } } };

  assert.equal(await ensureStaffRolePingable(guild, role), true);
  assert.equal(changed, false);
});

test('bot MentionEveryone permission allows staff role notifications', async () => {
  const role = { mentionable: false, editable: false };
  const guild = {
    members: {
      me: {
        permissions: {
          has: permission => permission === PermissionFlagsBits.MentionEveryone
        }
      }
    }
  };

  assert.equal(await ensureStaffRolePingable(guild, role), true);
});

test('bot enables mentionability when it can manage the staff role', async () => {
  let reason;
  const role = {
    mentionable: false,
    editable: true,
    setMentionable: async (value, auditReason) => {
      assert.equal(value, true);
      reason = auditReason;
    }
  };
  const guild = {
    members: {
      me: {
        permissions: {
          has: permission => permission === PermissionFlagsBits.ManageRoles
        }
      }
    }
  };

  assert.equal(await ensureStaffRolePingable(guild, role), true);
  assert.equal(reason, 'Enable immediate ticket staff notifications');
});

test('setup is blocked when the bot cannot make the staff role pingable', async () => {
  const role = { mentionable: false, editable: false };
  const guild = {
    members: {
      me: {
        permissions: {
          has: () => false
        }
      }
    }
  };

  assert.equal(await ensureStaffRolePingable(guild, role), false);
});

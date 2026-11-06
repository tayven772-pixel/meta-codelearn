import { PermissionFlagsBits } from 'discord.js';
import { getSetting } from './database.js';

// Conservative URL matching: handles normal links, Discord invites, and markdown links.
const LINK_RE = /(?:https?:\/\/|www\.)[^\s<>()]+|discord\.gg\/[\w-]+|discord(?:app)?\.com\/invite\/[\w-]+/i;
const NSFW_PROFILE_RE = /(?:\bnsfw\b|\b18\s*\+\b|\badult\s*only\b|\bexplicit\b|\bsexual\s*content\b|\bporn(?:ographic)?\b)/i;
const historicalScanLocks = new Set();

function ownerId() {
  return String(getSetting('global', 'link_protection_owner_id') || process.env.META_SECURITY_ALERT_USER_ID || '').trim();
}
function isEnabled(guildId, key) {
  return getSetting(guildId, key) === 'true';
}
function isLinkMessage(message) {
  if (LINK_RE.test(message.content || '')) return true;
  if (message.embeds?.some(embed => LINK_RE.test([embed.url, embed.title, embed.description, embed.author?.url, embed.footer?.text, ...(embed.fields || []).flatMap(field => [field.name, field.value])].filter(Boolean).join(' ')))) return true;
  return Boolean(message.components?.some(row => row.components?.some(component => LINK_RE.test(component.url || ''))));
}

export async function handleLinkProtection(message) {
  if (!message.guild || message.author?.bot || message.webhookId || !isEnabled(message.guild.id, 'link_protection_enabled')) return;
  const allowId = ownerId();
  if (!allowId || message.author.id === allowId) return;
  if (!isLinkMessage(message)) return;
  if (!message.deletable || !message.guild.members.me?.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages)) {
    console.warn('[Security] Link protection could not delete message (permission/age):', message.id, message.guild.id);
    return;
  }
  try {
    await message.delete();
    console.log('[Security] Deleted non-owner link message:', message.id, 'guild:', message.guild.id, 'author:', message.author.id);
  } catch (error) {
    console.error('[Security] Link deletion failed:', error?.message || error);
  }
}

// One-time recent-history cleanup per guild after bot startup. Discord limits
// message fetches; this intentionally caps work to the most recent 100/channel.
export async function scanRecentLinks(guild) {
  if (!guild || historicalScanLocks.has(guild.id) || !isEnabled(guild.id, 'link_protection_enabled')) return;
  const allowId = ownerId();
  if (!allowId) {
    console.warn('[Security] Link protection is enabled but link_protection_owner_id is empty; no messages will be removed.');
    return;
  }
  historicalScanLocks.add(guild.id);
  try {
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isTextBased?.() || !channel.messages?.fetch) continue;
      if (!guild.members.me?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) continue;
      let messages;
      try { messages = await channel.messages.fetch({ limit: 100 }); } catch { continue; }
      for (const message of messages.values()) {
        if (message.author?.id === allowId || message.author?.bot || message.webhookId || !isLinkMessage(message)) continue;
        if (!message.deletable) continue;
        try { await message.delete(); } catch (error) {
          console.warn('[Security] Historical link cleanup failed:', message.id, error?.message || error);
        }
      }
    }
  } finally {
    historicalScanLocks.delete(guild.id);
  }
}

async function moderateServerProfile(member) {
  if (!member?.guild || !isEnabled(member.guild.id, 'server_profile_guard_enabled')) return;
  // Discord's server profile data exposed to bots includes the per-server
  // nickname/display name. Discord does not provide a reliable bot API for
  // classifying profile images, banners, or account bio here.
  const nickname = String(member.nickname || '').trim();
  if (!nickname || !NSFW_PROFILE_RE.test(nickname)) return;
  const botMember = member.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers) || !member.bannable) {
    console.warn('[Security] Flagged server nickname but bot cannot ban member:', member.id, member.guild.id);
    return;
  }
  try {
    await member.guild.members.ban(member.id, {
      reason: 'Meta Code server-profile guard: server nickname matched a configured NSFW indicator',
      deleteMessageSeconds: 0
    });
    console.warn('[Security] Banned member for flagged server nickname:', member.id, member.guild.id);
  } catch (error) {
    console.error('[Security] Server-profile ban failed:', error?.message || error);
  }
}

export async function handleServerProfileUpdate(member) {
  await moderateServerProfile(member);
}

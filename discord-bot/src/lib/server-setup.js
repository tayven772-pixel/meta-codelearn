import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { getSetting } from './database.js';

export const serverSetupCommand = new SlashCommandBuilder()
  .setName('setup-server')
  .setDescription('Safely add the Meta Code community template without deleting existing channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const roleDefinitions = [
  { name: 'Founder', color: 0xF4C95D },
  { name: 'Administrator', color: 0x8D9DFF },
  { name: 'Moderator', color: 0x70C7A1 },
  { name: 'Support Team', color: 0x8AD7E8 },
  { name: 'Mentor', color: 0xB8A1F4 },
  { name: 'Developer', color: 0xB3D9A1 },
  { name: 'Community Member', color: 0xD7DCE4 }
];

const layout = [
  {
    name: '📍 GET STARTED',
    channels: [
      ['text', 'welcome'],
      ['text', 'rules'],
      ['text', 'announcements'],
      ['text', 'official-links'],
      ['text', 'choose-roles']
    ]
  },
  {
    name: '💬 COMMUNITY',
    channels: [
      ['text', 'general-chat'],
      ['text', 'introductions'],
      ['text', 'questions'],
      ['text', 'ideas-and-feedback'],
      ['text', 'project-showcase']
    ]
  },
  {
    name: '💻 LEARN AND BUILD',
    channels: [
      ['text', 'learning-resources'],
      ['text', 'web-development'],
      ['text', 'discord-bots'],
      ['text', 'coding-challenges'],
      ['text', 'github-and-projects']
    ]
  },
  {
    name: '🛟 META SUPPORT',
    channels: [
      ['text', 'open-a-ticket'],
      ['text', 'bug-reports'],
      ['text', 'suggestions']
    ]
  },
  {
    name: '🔊 VOICE LOUNGE',
    channels: [
      ['voice', 'Community Lounge'],
      ['voice', 'Coding Together'],
      ['voice', 'AFK']
    ]
  },
  {
    name: '🔐 STAFF HQ',
    private: true,
    channels: [
      ['text', 'staff-chat'],
      ['text', 'staff-applications'],
      ['text', 'ticket-logs'],
      ['text', 'moderation-logs']
    ]
  }
];

export async function handleServerSetup(interaction, confirmed = false, alreadyDeferred = false) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: 'Run this command inside your Discord server.',
      ephemeral: true
    });
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: 'You need Administrator permission to use this command.',
      ephemeral: true
    });
  }

  if (!alreadyDeferred) await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const botMember = guild.members.me ??
    await guild.members.fetchMe();

  const requiredPermissions = [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory
  ];

  const missing = requiredPermissions.filter(
    permission => !botMember.permissions.has(permission)
  );

  if (missing.length) {
    return interaction.editReply(
      'I am missing required server permissions. Please grant me Manage Channels, Manage Roles, View Channels, Send Messages, Embed Links, and Read Message History, then run `/setup-server` again.'
    );
  }


  // Setup is deliberately additive: existing channels and message history are never deleted.
  const errors = [];
  let activeRoleDefinitions = roleDefinitions;
  let activeLayout = layout;
  const savedTemplate = getSetting(guild.id, 'server_setup_template');
  if (savedTemplate) {
    try {
      const parsed = JSON.parse(savedTemplate);
      if (!Array.isArray(parsed.roles) || !Array.isArray(parsed.categories) ||
          parsed.roles.length > 40 || parsed.categories.length > 30 ||
          parsed.roles.some(role => typeof role.name !== 'string' || !role.name.trim() || role.name.length > 100) ||
          parsed.categories.some(group => typeof group.name !== 'string' || !group.name.trim() || !Array.isArray(group.channels) || group.channels.length > 50 ||
            group.channels.some(channel => !Array.isArray(channel) || !['text','voice'].includes(channel[0]) || typeof channel[1] !== 'string' || !channel[1].trim() || channel[1].length > 100))) {
        throw new Error('Template must contain roles and categories with valid channel entries.');
      }
      activeRoleDefinitions = parsed.roles.map(role => ({ name: role.name.trim(), color: Number.isInteger(role.color) && role.color >= 0 && role.color <= 0xFFFFFF ? role.color : 0xD7DCE4 }));
      activeLayout = parsed.categories.map(group => ({ name: group.name.trim().slice(0, 100), private: Boolean(group.private), channels: group.channels.map(([kind, name]) => [kind, name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'new-channel']) }));
    } catch (error) {
      errors.push(`Saved setup template was invalid; used the built-in template instead: ${error.message}`);
    }
  }

  const created = [];
  const reused = [];

  for (const definition of activeRoleDefinitions) {
    try {
      let role = guild.roles.cache.find(
        item => item.name === definition.name
      );

      if (!role) {
        role = await guild.roles.create({
          name: definition.name,
          color: definition.color,
          reason: 'Meta CodeLearn server setup'
        });
        created.push(`role: ${definition.name}`);
      } else {
        reused.push(`role: ${definition.name}`);
      }
    } catch (error) {
      errors.push(`Role ${definition.name}: ${error.message}`);
    }
  }

  const staffRole = guild.roles.cache.find(
    role => role.name === 'Administrator'
  );

  for (const group of activeLayout) {
    try {
      let category = guild.channels.cache.find(
        channel =>
          channel.type === ChannelType.GuildCategory &&
          channel.name === group.name
      );

      if (!category) {
        const overwrites = group.private
          ? [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
              },
              ...(staffRole ? [{
                id: staffRole.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              }] : [])
            ]
          : [];

        category = await guild.channels.create({
          name: group.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites,
          reason: 'Meta CodeLearn server setup'
        });
        created.push(`category: ${group.name}`);
      } else {
        reused.push(`category: ${group.name}`);
      }

      for (const [kind, name] of group.channels) {
        try {
          const type = kind === 'voice'
            ? ChannelType.GuildVoice
            : ChannelType.GuildText;

          const existing = guild.channels.cache.find(
            channel =>
              channel.name === name &&
              channel.type === type &&
              channel.parentId === category.id
          );

          if (existing) {
            reused.push(`channel: ${name}`);
            continue;
          }

          await guild.channels.create({
            name,
            type,
            parent: category.id,
            reason: 'Meta CodeLearn server setup'
          });

          created.push(`channel: ${name}`);
        } catch (error) {
          errors.push(`Channel ${name}: ${error.message}`);
        }
      }
    } catch (error) {
      errors.push(`Category ${group.name}: ${error.message}`);
    }
  }

  const welcome = guild.channels.cache.find(
    channel => channel.name === 'welcome' &&
      channel.type === ChannelType.GuildText
  );

  if (welcome) {
    try {
      const alreadyPosted = (await welcome.messages.fetch({
        limit: 10
      })).some(message =>
        message.author.id === botMember.id &&
        message.embeds.some(embed =>
          embed.title === 'Welcome to Meta CodeLearn!'
        )
      );

      if (!alreadyPosted) {
        const embed = new EmbedBuilder()
          .setColor(0x54C8D8)
          .setTitle('Welcome to Meta CodeLearn!')
          .setDescription(
            'A friendly community for learning, building projects, and helping each other grow.'
          )
          .addFields(
            {
              name: '💻 Learn',
              value: 'Explore coding topics and resources.',
              inline: true
            },
            {
              name: '🛠️ Build',
              value: 'Share websites, bots, and projects.',
              inline: true
            },
            {
              name: '🤝 Connect',
              value: 'Meet other learners and creators.',
              inline: true
            },
            {
              name: '🚀 Get started',
              value: 'Read #rules, introduce yourself, and join the conversation.'
            }
          )
          .setFooter({
            text: 'Learn together. Build together. Grow together.'
          });

        await welcome.send({ embeds: [embed] });
      }
    } catch (error) {
      errors.push(`Welcome message: ${error.message}`);
    }
  }

  const rules = guild.channels.cache.find(
    channel => channel.name === 'rules' &&
      channel.type === ChannelType.GuildText
  );

  if (rules) {
    try {
      const alreadyPosted = (await rules.messages.fetch({
        limit: 10
      })).some(message =>
        message.author.id === botMember.id &&
        message.embeds.some(embed =>
          embed.title === 'Meta CodeLearn Community Rules'
        )
      );

      if (!alreadyPosted) {
        const embed = new EmbedBuilder()
          .setColor(0x54C8D8)
          .setTitle('Meta CodeLearn Community Rules')
          .setDescription([
            '1. Treat everyone with respect.',
            '2. No harassment, hate, or threats.',
            '3. Keep messages in the appropriate channels.',
            '4. No spam or unsolicited advertising.',
            '5. Never share passwords, tokens, or private information.',
            '6. Only share projects and content you have permission to share.',
            '7. Follow Discord’s Terms of Service and Community Guidelines.',
            '8. Follow moderator instructions and use support tickets when needed.'
          ].join('\n\n'))
          .setFooter({
            text: 'Help us keep Meta CodeLearn friendly and welcoming.'
          });

        await rules.send({ embeds: [embed] });
      }
    } catch (error) {
      errors.push(`Rules message: ${error.message}`);
    }
  }

  const summary = [
    '✅ **Meta Code setup finished. Existing channels and messages were preserved.**',
    `Created: ${created.length} items`,
    `Already existed: ${reused.length} items`,
    `Issues: ${errors.length}`
  ];

  if (errors.length) {
    summary.push(
      '',
      '**Issues to review:**',
      ...errors.slice(0, 8).map(error => `• ${error}`)
    );
  }

  summary.push(
    '',
    'Please review channel permissions and assign trusted staff roles before opening the server to everyone.'
  );

  await interaction.editReply(summary.join('\n'));
}


export async function handleServerSetupButton(interaction) {
  if (interaction.customId === 'setup_server_cancel') {
    return interaction.update({
      content: 'Reset cancelled. No channels were deleted.',
      components: [],
      embeds: []
    });
  }

  if (interaction.customId === 'setup_server_confirm') {
    return interaction.update({ content: 'The destructive reset option has been retired. Run `/setup-server` to add missing template channels safely.', components: [], embeds: [] });
  }
}

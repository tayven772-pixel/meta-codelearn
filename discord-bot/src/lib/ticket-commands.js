import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from 'discord.js';

export const ticketCommand = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Manage Meta CodeLearn support tickets')
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Configure the ticket system')
      .addChannelOption(option =>
        option.setName('category')
          .setDescription('Category where ticket channels are created')
          .setRequired(true)
          .addChannelTypes(4)
      )
      .addRoleOption(option =>
        option.setName('staff_role')
          .setDescription('Role allowed to access and manage tickets')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option.setName('log_channel')
          .setDescription('Private channel for ticket logs')
          .setRequired(true)
          .addChannelTypes(0)
      )
  )
  .addSubcommand(sub =>
    sub.setName('panel')
      .setDescription('Post the support ticket panel in this channel')
  )
  .addSubcommand(sub =>
    sub.setName('claim')
      .setDescription('Claim the current ticket')
  )
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Give a member access to the current ticket')
      .addUserOption(option =>
        option.setName('member')
          .setDescription('Member to add')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Remove a member from the current ticket')
      .addUserOption(option =>
        option.setName('member')
          .setDescription('Member to remove')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('close')
      .setDescription('Close the current ticket')
  )
  .addSubcommand(sub =>
    sub.setName('reopen')
      .setDescription('Reopen the current ticket')
  )
  .addSubcommand(sub =>
    sub.setName('transcript')
      .setDescription('Create a transcript of the current ticket')
  );

export const ticketPanelCommand = new SlashCommandBuilder()
  .setName('ticket-panel')
  .setDescription('Post a support ticket panel in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

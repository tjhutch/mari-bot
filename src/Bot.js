import Discord from 'discord.js';
import utils from './Utils';
import actions from './BotActions';
import loggerFactory from './Logger';
import CommandConfig from './config/CommandConfig';
import Memes from './config/Memes';
import Tokens from './config/Tokens';
import GuildSettings from './config/GuildSettings';
import GuildLevels from './config/GuildLevels';
import util from 'util';


const logger = loggerFactory.getLogger();

export default class Bot {
  constructor() {
    CommandConfig.commands.meme = Memes;
    this.commands = CommandConfig.commands;
    this.prefix = CommandConfig.prefix;
    this.token = Tokens.discordToken;
    this.typingStatus = {};
    this.guildSettings = GuildSettings;
    this.guildLevels = GuildLevels;
    this.configureBot();
    this.reset();
    logger.log('info', `Commands[createrolemessage]: ${this.commands.createrolemessage}`);
  }

  // sets all the handlers for bot actions
  configureBot() {
    this.bot = new Discord.Client();
    this.bot.on('message',               this.onMessage.bind(this));
    this.bot.on('voiceStateUpdate',      this.newPhoneWhoDis.bind(this));
    this.bot.on('messageReactionAdd',    this.reactionAdded.bind(this));
    this.bot.on('messageReactionRemove', this.reactionRemoved.bind(this));
    this.bot.on('typingStart',           this.typingStart.bind(this));
    this.bot.on('typingStop',            this.typingStop.bind(this));
    this.bot.on('ready', () => logger.log('info', 'Mari bot ready for combat!'));
    this.bot.on('warn', warning => logger.log('warn', `warning: ${warning}`));
    this.bot.on('guildMemberAdd', (member) => {
      const guildSettings = GuildSettings[member.guild.name];
      if (guildSettings && guildSettings.welcomeMessage && guildSettings.welcomeChannel) {
        actions.welcomeMember(member, guildSettings);
      }
    });

    this.bot.on('error', (e) => {
      logger.log('error', `ERROR bot crashed!: ${e}`);
      try {
        logger.log('info', 'attempting to reset bot');
        this.reset();
      } catch (error) {
        logger.log('error', `Could not reset the bot: ${error}`);
        process.exit(1);
      }
    });

    this.bot.on('disconnect', (closeEvent) => {
      logger.log('warn', `Websocket connection failed with error code ${closeEvent.code}! attempting to restart bot`);
      logger.log('warn', closeEvent.reason);
      this.reset();
    });

    this.bot.on('debug', (info) => {
      // ignore heartbeats
      if (info.toLowerCase().includes('heartbeat')) {
        return;
      }
      logger.log('info', `debug: ${info}`);
    });
  }

  // send 'blocked' as a reaction to the message
  async blocked(reaction) {
    const { message } = reaction;
    if (this.blockingMessage === message.id) {
      reaction.users.map((user) => {
        reaction.remove(user);
        user.send('Shhh I\'m working');
      });
      return;
    }
    // 📢🇧🇱🇴🇨🇰🇪🇩
    this.blockingMessage = message.id;
    try {
      await message.react('🇧');
      await message.react('🇱');
      await message.react('🇴');
      await message.react('🇨');
      await message.react('🇰');
      await message.react('🇪');
      await message.react('🇩');
      logger.log('info', 'sent \'blocked\' reaction');
      this.blockingMessage = null;
    } catch (e) {
      logger.log('error', `failed to send blocked: ${e}`);
      this.blockingMessage = null;
    }
  }

  typingStart(channel) {
    if (!this.typingStatus[channel.id]) {
      this.typingStatus[channel.id] = {};
      this.typingStatus[channel.id].count = 0;
    }
    this.typingStatus[channel.id].count++;
    if (this.typingStatus[channel.id].count >= 3) {
      if (this.typingStatus[channel.id].count >= 6 && !this.typingStatus[channel.id].specialTimeout) {
        // easter egg (shhhh)
        channel.send('How many of you bastards are there!?');
        this.typingStatus[channel.id].specialTimeout = true;
        this.typingStatus[channel.id].timeout = true;
        setTimeout(() => {
          this.typingStatus[channel.id].specialTimeout = false;
        }, 15000);
      } else if (!this.typingStatus[channel.id].timeout) {
        // send several people typing message if not timed out
        channel.send('SEVERAL PEOPLE ARE TYPING');
        this.typingStatus[channel.id].timeout = true;
        // don't spam
        setTimeout(() => {
          this.typingStatus[channel.id].timeout = false;
        }, 15000);
      }
    }
  }

  typingStop(channel) {
    if (!this.typingStatus[channel.id]) {
      this.typingStatus[channel.id] = {};
      this.typingStatus[channel.id].count = 0;
    } else {
      if (this.typingStatus[channel.id].count > 0) {
        this.typingStatus[channel.id].count--;
      } else {
        this.typingStatus[channel.id].count = 0;
      }
    }
  }

  async reactionAdded(reaction, user) {
    if (user.bot) {
      return;
    }
    const { channel } = reaction.message;
    if (channel.guild && GuildSettings[channel.guild.name].react && reaction.emoji.name === '📢') {
      this.blocked(reaction);
    } else {
      this.managePermissions(reaction, user, true);
    }
  }

  async reactionRemoved(reaction, user) {
    if (user.bot) {
      return;
    }
    this.managePermissions(reaction, user, false);
  }

  async managePermissions(reaction, user, add) {
    const { message } = reaction;
    const { channel } = message;
    if (!channel.guild.available) {
      logger.log('error', `Got reaction, but guild ${channel.guild.name} is not available!`);
      return;
    }
    const currentGuildSettings = this.guildSettings[channel.guild.name];
    if (currentGuildSettings.managedRoles && message.id === currentGuildSettings.roleMessageID) {
      try {
        const role = this.matchRoleToReaction(reaction, user, channel.guild, currentGuildSettings);
        const guildUser = await channel.guild.fetchMember(user);
        const newUser = await (add ? guildUser.addRole(role) : guildUser.removeRole(role));
        logger.log('info', `${add ? 'added' : 'removed'} the role ${role.name} for ${newUser.displayName}`);
      } catch (e) {
        logger.log('error', `Failed to give role to user: ${e}`);
      }
    }
  }

  matchRoleToReaction(reaction, user, guild, currentGuildSettings) {
    for(let i = 0; i < currentGuildSettings.roleReactions.length; i++) {
      let roleReaction = currentGuildSettings.roleReactions[i];
      if (roleReaction === reaction.emoji.name) {
        try {
          const roleName = currentGuildSettings.managedRoles[i];
          return this.getRoleByName(guild, roleName);
        } catch (e) {
          logger.log('error', `Failed to get role for user: ${e}`)
        }
      }
    }
  }

  getRoleByName(guild, roleName) {
    return guild.roles.filter(role => role.name === roleName).first();
  }

  manageRolesByMsg(msg, add) {
    const users = msg.mentions.members;
    const role = this.getRoleByName(msg.split(' ')[1]);
    try {
      users.map(async user => {
        const newUser = await (add ? user.addRole(role) : user.removeRole(role));
        logger.log('info', `${add ? 'added' : 'removed'} role ${role.name} ${add ? 'to' : 'from'} ${newUser.username}`);
      });
    } catch (e) {
      logger.log('error', `Failed to ${add ? 'add' : 'remove'} role ${add ? 'to' : 'from'} users in "${msg.content}": ${e}`);
    }
  }

  // NEW PHONE WHO DIS
  // play new phone audio clip when a new user comes into the same channel as the bot
  newPhoneWhoDis(oldMember, newMember) {
    if (this.bot.voiceConnections.size === 0) {
      return;
    }
    if (oldMember && newMember) {
      if (oldMember.mute !== newMember.mute || oldMember.deaf !== newMember.deaf) {
        return;
      }
    }
    if (newMember && newMember.voiceChannelID) {
      const voiceConnection = actions.getChannelVoice(newMember.voiceChannelID, this.bot.voiceConnections);
      if (voiceConnection) {
        actions.playAudioCommand(this.bot.voiceConnections, this.commands.newphone, newMember.voiceChannelID, voiceConnection);
      }
    }
  }

  // handling of normal CommandConfig
  // check if this channel allows the bot and if this user can use the bot in this server.
  // Then, if the message contains a command the bot can understand, handle it.
  // Then, pass along to the handler function
  onMessage(msg) {
    // don't respond to your own messages
    if (msg.author.username === 'mari-bot') {
      return;
    }

    // storing Memes for later use
    if (msg.channel && msg.channel.name && msg.channel.name.includes('Memes')) {
      this.saveMeme(msg);
    }

    // load data for current guild setup and user levels
    // no guild means message is PM, so guild restrictions are not applicable
    const { guild } = msg.channel;
    const currentGuildSettings = guild ? this.guildSettings[guild.name] : null;
    const currentGuildLevels = guild ? this.guildLevels[guild.name] : null;

    // check if we should level up a user
    if (currentGuildSettings && currentGuildLevels) {
      actions.levelUpUser(currentGuildLevels, currentGuildSettings, msg.author, msg.channel);
    }

    // ignore if message doesn't start with the prefix
    if (!msg.content.startsWith(this.prefix)) {
      return;
    }

    // check if this is a channel that the bot should read
    // if no registered settings assume no restrictions
    if (currentGuildSettings) {
      if (!this.botCanPostToChannel(currentGuildSettings.channels, msg.channel)) { // make sure this channel is ok to use
        msg.author.send(`Sorry, you can't use mari-bot from ${msg.channel.name} in ${msg.channel.guild.name}`);
        return;
      }
      if (!this.userAllowedToUseBot(currentGuildSettings.roles, msg.member.roles)) { // make sure user is allowed to use bot
        msg.author.send(`Sorry, you don't have permission to use mari-bot in ${msg.channel.guild.name}`);
        return;
      }
    }
    // CommandConfig can't have spaces, remove anything beyond the first space
    let [importantBit] = msg.content.split(' ');
    // cut out the prefix
    importantBit = importantBit.toLowerCase().slice(1);
    logger.log('info', `Received: ${importantBit}`);
    for (const command in this.commands) {
      if (!this.commands.hasOwnProperty(command)) {
        continue;
      }
      if (importantBit === command) {
        this.handleCommand(this.commands[command], msg, currentGuildLevels, currentGuildSettings);
      }
    }
  }

  userAllowedToUseBot(allowedRoles, userRoles) {
    // if no options, assume all are allowed
    if (!allowedRoles) {
      return true;
    }
    for (const role of allowedRoles) {
      if (userRoles.filter(userRole => userRole.name.toLowerCase() === role.toLowerCase()).size) {
        return true;
      }
    }
    return false;
  }

  botCanPostToChannel(allowedChannels, channel) {
    // if no options, assume all are allowed
    if (!allowedChannels) {
      return true;
    }
    return !!allowedChannels.filter(channelName => channel.name === channelName).length;
  }

  // Reset the bot (or start it if it's not already running)
  // if channel is given, notify that channel when reset is complete
  reset(channel) {
    if (this.bot && this.bot.readyTimestamp) {
      this.bot.destroy().then(() => {
        this.bot.login(this.token).then(() => {
          logger.log('info', 'Reset complete!');
        });
      }).catch((reason) => {
        logger.log('info', `Failed to logout: ${reason}`);
      });
    } else {
      this.bot.login(this.token).then(() => {
        if (channel) {
          channel.send('Reset complete!');
        }
      });
    }
  }

  // breakout command types into their handler functions
  async handleCommand(command, msg, guildLevels, guildSettings) {
    const type = command.type.toLowerCase();
    switch (type) {
      case 'audio': {
        actions.handleAudioCommand(command, msg, this.bot.voiceConnections, this.bot.guilds);
        break;
      }
      case 'stop': {
        actions.stopTalkingInGuild(msg.guild, this.bot.voiceConnections);
        break;
      }
      case 'text': {
        if (command.response) {
          actions.sendMessage(command.response, msg.channel);
        } else {
          const beginning = command.beginning ? command.beginning : '';
          const response = command.responses[Math.floor(Math.random() * command.responses.length)];
          const ending = command.ending ? command.ending : '';
          actions.sendMessage(beginning + response + ending, msg.channel);
        }
        break;
      }
      case 'move': {
        actions.joinChannel(this.bot.guilds, msg);
        break;
      }
      case 'leave': {
        const connection = actions.getVoiceInGuild(this.bot.voiceConnections, msg.guild);
        if (connection) {
          connection.on('disconnect', () => {
            logger.log('info', 'Disconnected from voice');
          });
          connection.disconnect();
        }
        break;
      }
      case 'go': {
        const channelName = msg.content.substring(4);
        logger.log('info', `Moving to: ${channelName}`);
        actions.joinChannel(this.bot.guilds, null, channelName);
        break;
      }
      case 'meme': {
        const { urls } = command;
        const url = urls[Math.floor(Math.random() * urls.length)];
        actions.sendMessage(url, msg.channel);
        break;
      }
      case 'memeAdd': {
        this.saveMeme(msg);
        break;
      }
      case 'help': {
        actions.sendHelpMessage(msg, this.commands);
        break;
      }
      case 'level': {
        const userName = msg.content.substring(7);
        const level = actions.getLevelOfUser(guildLevels, guildSettings, msg.channel.guild.members, userName);
        if (level) {
          actions.sendMessage(`${userName} is level ${level}`, msg.channel);
        } else {
          actions.sendMessage(`${userName} is not a user in this discord server`, msg.channel);
        }
        break;
      }
      case 'addText': {
        this.addTextCommand(msg);
        break;
      }
      case 'addRole': {
        this.manageRolesByMsg(msg, true);
        break;
      }
      case 'removeRole': {
        this.manageRolesByMsg(msg, false);
        break;
      }
      case 'createrolemessage': {
        const { guild } = msg.channel;
        if (!guild.available) {
          logger.log('error', `Could not create role message, ${guild.name} is not available.`);
          return;
        }
        const guildSettings = guild ? this.guildSettings[guild.name] : null;
        if (guildSettings.roleMessageID && guildSettings.roleMessageChannel) {
          const message = guild.channels.get(guildSettings.roleMessageChannel).fetchMessage(guildSettings.roleMessageID);
          const reactionCollector = message.createReactionCollector();
          reactionCollector.on('collect', (obj) => {
            logger.log('info', util.inspect(obj, {showHidden: false, depth: null}));
          });
        }
        if (guildSettings && guildSettings.roleMessage && !guildSettings.roleMessageID) {
          const message = await actions.sendMessage(guildSettings.roleMessage, msg.channel);
          for (let reaction of guildSettings.roleReactions) {
            try {
              await message.react(reaction);
            } catch (e) {
              logger.log('error', `Failed to add starter reactions to role message: ${e}`)
            }
          }
          logger.log('info', `saving role message/channel ids: ${message.id}, ${message.channel.id}`);
          this.guildSettings[guild.name].roleMessageID = message.id;
          this.guildSettings[guild.name].roleMessageChannel = message.channel.id;
          this.commandsUpdated = true;
        }
        break;
      }
      case 'reset': {
        this.reset(msg.channel);
        break;
      }
      default: {
        actions.sendMessage('Something\'s fucked. Yell at Taylor to fix it.', msg.channel);
        break;
      }
    }
  }

  addTextCommand(msg) {
    const str = msg.content.split('!addText')[1].split(' ');
    const name = str[0];
    str[0] = '';
    const response = str.join();
    this.commands[name] = {
      type: 'text',
      response
    };
    this.commandsUpdated = true;
  }

  saveMeme(msg) {
    const words = msg.content.split(' ');
    for (let i = 0; i < words.length; i += 1) {
      const meme = words[i];
      if (utils.isURL(meme)) {
        if (this.commands.meme.urls.indexOf(meme) === -1) {
          this.commands.meme.urls.push(meme);
          this.memesUpdated = true;
          logger.log('info', `Added a new meme to my collection: \n${meme}`);
        } else {
          logger.log('info', `Avoided duplicate meme: ${meme}`);
        }
      }
    }
  }

  sendSubMessage(streamer) {
    const msg = (streamer.message ? streamer.message : `${streamer.name} is now live on twitch! https://www.twitch.tv/${streamer.name}`);
    for (const server of streamer.servers) {
      actions.sendMessage(msg, this.bot.guilds.get(server.id).channels.get(server.channel));
    }
  }
}

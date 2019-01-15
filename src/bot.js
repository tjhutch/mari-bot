const Discord = require('discord.js');
const utils = require('./utils');
const actions = require('./botActions');
const logger = require('./logger').getLogger();
const config = require('./configManager').getConfigManager();

class Bot {
  constructor(commands, token, guildSettings, guildLevels) {
    this.commands = commands.commands;
    this.prefix = commands.prefix;
    this.token = token;
    this.guildSettings = guildSettings;
    this.guildLevels = guildLevels;
    this.blocking = false;
    this.configureBot();
    this.resetBot();
  }

  // sets all the handlers for bot actions
  configureBot() {
    this.bot = new Discord.Client();
    this.bot.on('ready', () => {
      logger.log('info', 'Mari bot ready for combat!');
    });

    this.bot.on('message', (msg) => {
      this.handleMessage(msg);
    });

    this.bot.on('guildMemberAdd', (member) => {
      const guildSettings = this.guildSettings[member.guild.name];
      if (guildSettings && guildSettings.welcomeMessage && guildSettings.welcomeChannel) {
        actions.welcomeMember(member, guildSettings);
      }
    });

    this.bot.on('voiceStateUpdate', (newMember, oldMember) => {
      this.newPhoneWhoDis(newMember, oldMember);
    });

    this.bot.on('messageReactionAdd', (reaction) => {
      this.handleReactionAdded(reaction);
    });

    this.bot.on('messageReactionRemove', (reaction) => {
      this.handleReactionRemoved(reaction);
    });

    this.bot.on('error', (e) => {
      logger.log('error', 'ERROR bot crashed!: ');
      for (const prop of e) {
        logger.log('error', prop);
      }
      try {
        this.resetBot();
      } catch (error) {
        logger.log('error', `Could not reset the bot: ${error}`);
        process.exit(1);
      }
    });

    this.bot.on('warn', (warning) => {
      logger.log('warn', `warning: ${warning}`);
    });

    this.bot.on('disconnect', (closeEvent) => {
      logger.log('warn', `Websocket connection failed with error code ${closeEvent.code}! attempting to restart bot`);
      logger.log('warn', closeEvent.reason);
      this.resetBot();
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
  blocked(msg) {
    // 📢🇧🇱🇴🇨🇰🇪🇩
    this.blocking = true;
    msg.react('🇧').then(() => {
      return msg.react('🇱');
    }).then(() => {
      return msg.react('🇴');
    }).then(() => {
      return msg.react('🇨');
    }).then(() => {
      return msg.react('🇰');
    }).then(() => {
      return msg.react('🇪');
    }).then(() => {
      return msg.react('🇩');
    }).then(() => {
      logger.log('info', 'sent \'blocked\' reaction');
      this.blocking = false;
    }).catch((e) => {
      logger.log('error', `failed to send blocked: ${e}`);
      this.blocking = false;
    });
  }

  handleReactionAdded(reaction) {
    // this means the bot has already added this reaction
    if (reaction.me) {
      return;
    }
    const { channel } = reaction.message;
    if (!channel.guild || this.guildSettings[channel.guild.name].react) {
      if (this.blocking) {
        reaction.users.map((user) => {
          reaction.remove(user);
          user.send('Shhh I\'m working');
        });
        return;
      }
      if (reaction.emoji.name === '📢') {
        this.blocked(reaction.message);
      }
      reaction.message.react(reaction.emoji).then(() => {
        logger.log('info', `Reacted with ${reaction.emoji}`);
      }).catch((e) => {
        logger.log('error', `Failed to react to message: ${e}`);
      });
    }
  }

  handleReactionRemoved(reaction) {
    // don't remove until the bot is the only one left who's reacted
    if (reaction.users.length > 1) {
      return;
    }
    const { channel } = reaction.message;
    if (!channel.guild || this.guildSettings[channel.guild.name].react) {
      if (reaction.users.get(this.bot.user.id)) {
        reaction.remove(this.bot.user).then(() => {
          logger.log('info', `Removed reaction ${reaction.emoji}`);
        }).catch((e) => {
          logger.log('error', `Failed to remove reaction: ${e}`);
        });
      }
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

  // handling of normal commands
  // check if this channel allows the bot and if this user can use the bot in this server.
  // Then, if the message contains a command the bot can understand, handle it.
  // then pass along to the handler function
  handleMessage(msg) {
    // don't respond to your own messages
    if (msg.author.username === 'mari-bot') {
      return;
    }

    // storing memes for later use
    if (msg.channel && msg.channel.name && msg.channel.name.includes('memes')) {
      this.saveMeme(msg);
    }

    // load data for current guild setup and user levels
    // no guild means message is PM, so guild restrictions are not applicable
    const currentGuildSettings = msg.channel.guild ? this.guildSettings[msg.channel.guild.name] : null;
    const currentGuildLevels = msg.channel.guild ? this.guildLevels[msg.channel.guild.name] : null;

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
    // commands can't have spaces, remove anything beyond the first space
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
  resetBot(channel) {
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
  handleCommand(command, msg, guildLevels, guildSettings) {
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
      case 'reset': {
        config.readCommands().then((commands) => {
          this.setConfigAndReset(commands, msg.channel);
        });
        break;
      }
      default: {
        actions.sendMessage('Something\'s fucked. Yell at Taylor to fix it.', msg.channel);
        break;
      }
    }
  }

  saveMeme(msg) {
    const words = msg.content.split(' ');
    for (let i = 0; i < words.length; i += 1) {
      const meme = words[i];
      if (utils.isURL(meme)) {
        if (this.commands.meme.urls.indexOf(meme) === -1) {
          this.commands.meme.urls.push(meme);
          this.commandsUpdated = true;
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

  setConfigAndReset(data, channel, memes) {
    this.prefix = data.prefix;
    const tempMemes = this.commands.meme;
    this.commands = data.commands;
    if (memes) {
      this.commands.meme = memes;
    } else {
      this.commands.meme = tempMemes;
    }
    // start your engines!
    this.resetBot(channel);
  }
}

module.exports = Bot;

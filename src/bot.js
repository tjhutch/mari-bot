const Discord = require('discord.js');
const utils = require('./utils');
const actions = require('./botActions');
const log = require('./logger').getLogger();
const config = require('./configManager').getConfigManager();

class Bot {
  constructor(commands, token, guildSettings, guildLevels) {
    this.commands = commands.commands;
    this.prefix = commands.prefix;
    this.token = token;
    this.guildSettings = guildSettings;
    this.guildLevels = guildLevels;
    this.configureBot();
    this.resetBot();
  }


// sets all the handlers for bot actions
  configureBot() {
    this.bot = new Discord.Client();
    this.bot.on('ready', () => {
      log.info('Mari bot ready for combat!');
    });

    this.bot.on('message', (msg) => {
      this.handleMessage(msg)
    });

    this.bot.on('guildMemberAdd', (member) => {
      let guildSettings = this.guildSettings[member.guild.name];
      if (guildSettings && guildSettings.welcomeMessage && guildSettings.welcomeChannel) {
        actions.welcomeMember(member, guildSettings);
      }
    });

    this.bot.on('voiceStateUpdate', (newMember, oldMember) => {
      this.newPhoneWhoDis(newMember, oldMember);
    });

    this.bot.on('messageReactionAdd', (reaction, user) => {
      // this means the bot added this reaction
      if (reaction.me) {
        return;
      }
      if (this.guildSettings[reaction.user.guild.name].react) {
        reaction.message.react(reaction.emoji).then(() => {
          log.info('Reacted with ' + reaction.emoji);
        }).catch((e) => {
          log.error('Failed to react to message: ' + e);
        });
      }
    });

    this.bot.on('messageReactionRemove', (reaction, user) => {
      // this means the bot removed this reaction
      if (reaction.me) {
        return;
      }
      if (this.guildSettings[reaction.user.guild.name].react) {
        if (reaction.users.get(this.bot.user.id)) {
          reaction.remove(reaction.emoji).then(() => {
            log.info('Removed reaction ' + reaction.emoji);
          }).catch((e) => {
            log.error('Failed to remove reaction: ' + e);
          });
        }
      }
    });

    // Uh oh
    this.bot.on('error', (e) => {
      log.error('ERROR bot crashed!: ');
      for (let prop of e) {
        log.error(prop);
      }
      try {
        this.resetBot();
      } catch (e) {
        log.error('Could not reset the bot: ' + e);
        process.exit(1);
      }
    });

    this.bot.on('warn', (warning) => {
      log.warn('warning: ' + warning);
    });

    this.bot.on('disconnect', (closeEvent) => {
      log.warn(`Websocket connection failed with error code ${closeEvent.code}! attempting to restart bot`);
      log.warn(closeEvent.reason);
      this.resetBot();
    });

    this.bot.on('debug', (info) => {
      // ignore heartbeats
      if (info.toLowerCase().includes('heartbeat')) {
        return;
      }
      log.info(`debug: ${info}`);
    });
  }

  // NEW PHONE WHO DIS
  // play new phone audio clip when a new user comes into the same channel as the bot
  newPhoneWhoDis(oldMember, newMember) {
    // discord.js docs say to use bot.voiceConnections... BUT IT DOESN'T EXIST
    if (this.bot.voiceConnections.size === 0) {
      return;
    }
    if (oldMember && newMember) {
      if (oldMember.mute !== newMember.mute || oldMember.deaf !== newMember.deaf) {
        return;
      }
    }
    if (newMember && newMember.user.voiceChannel) {
      const voiceConnection = actions.getBotVoiceConnection(newMember.voiceChannel.id, this.bot.voiceConnections);
      if (voiceConnection) {
        actions.playAudioCommand(this.bot.voiceConnections, this.commands['newphone'], newMember.user.voiceChannel.id, voiceConnection);
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
      let words = msg.content.split(' ');
      for (let i = 0; i < words.length; i++) {
        if (utils.isURL(words[i])) {
          if (this.commands.meme.urls.indexOf(words[i]) === -1) {
            this.commands.meme.urls.push(words[i]);
            this.commandsUpdated = true;
            log.info('Added a new meme to my collection: \n' + words[i]);
          } else {
            log.info('Avoided duplicate meme: ' + words[i]);
          }
        }
      }
    }

    // load data for current guild setup and user levels
    // no guild means message is PM, so guild restrictions are not applicable
    let currentGuildSettings = msg.channel.guild ? this.guildSettings[msg.channel.guild.name] : null;
    let currentGuildLevels = msg.channel.guild ? this.guildLevels[msg.channel.guild.name] : null;

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
        msg.author.send('Sorry, you can\'t use mari-bot from ' + msg.channel.name + ' in ' + msg.channel.guild.name);
        return;
      }
      if (!this.userAllowedToUseBot(currentGuildSettings.roles, msg.member.roles)) { // make sure user is allowed to use bot
        msg.author.send("Sorry, you don't have permission to use mari-bot in " + msg.channel.guild.name);
        return;
      }
    }
    // commands can't have spaces, remove anything beyond the first space
    let [importantBit] = msg.content.split(' ');
    // cut out the prefix
    importantBit = importantBit.toLowerCase().slice(1);
    log.info('Received: ' + importantBit);
    for (let command in this.commands) {
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
    for (let role of allowedRoles) {
      if (userRoles.filter((userRole) => userRole.name.toLowerCase() === role.toLowerCase()).size) {
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
    return !!allowedChannels.filter((channelName) => channel.name === channelName).length
  }

// Reset the bot (or start it if it's not already running)
// if channel is given, notify that channel when reset is complete
  resetBot(channel) {
    if (this.bot && this.bot.readyTimestamp) {
      this.bot.destroy().then(() => {
        this.bot.login(this.token);
      }).catch((reason) => {
        log.info('Failed to logout: ' + reason);
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
    let type = command.type.toLowerCase();
    switch (type) {
      case 'audio':
        this.handleAudioCommand(command, msg);
        break;
      case 'stop':
        this.stopTalkingInGuild(msg.guild);
        break;
      case 'text':
        if (command.response) {
          actions.sendMessage(command.response, msg.channel);
        } else {
          let beginning = command.beginning ? command.beginning : "";
          let response = command.responses[Math.floor(Math.random() * command.responses.length)];
          let ending = command.ending ? command.ending : "";
          actions.sendMessage(beginning + response + ending, msg.channel);
        }
        break;
      case 'move':
        actions.joinChannel(this.bot.guilds, msg);
        break;
      case 'leave':
        const connection = actions.activeVoiceInGuild(this.bot.voiceConnections, msg.guild);
        if (connection) {
          connection.disconnect();
        }
        break;
      case 'go':
        const channelName = msg.content.substring(4);
        log.info('Moving to: ' + channelName);
        actions.joinChannel(this.bot.guilds, null, channelName);
        break;
      case 'meme':
        const urls = command.urls;
        let url = urls[Math.floor(Math.random() * urls.length)];
        actions.sendMessage(url, msg.channel);
        break;
      case 'help':
        this.sendHelpMessage(msg);
        break;
      case 'level':
        const userName = msg.content.substring(7);
        const level = actions.getLevelOfUser(guildLevels, guildSettings, msg.channel.guild.members, userName);
        if (level) {
          actions.sendMessage(`${userName} is level ${level}`, msg.channel);
        } else {
          actions.sendMessage(`${userName} is not a user in this discord server`, msg.channel);
        }
        break;
      case 'reset':
        config.readCommands().then((commands) => {
          this.setConfigAndReset(commands, msg.channel);
        });
        break;
      default:
        actions.sendMessage('Something\'s fucked. Yell at Taylor to fix it.', msg.channel);
        break;
    }
  }

  stopTalkingInGuild(guild) {
    let dispatcher = actions.activeVoiceInGuild(this.bot.voiceConnections, guild).dispatcher;
    if (dispatcher) {
      try {
        dispatcher.end();
      } catch (e) {
        log.warn('uncaught exception in stop: ' + e);
        // nothing to do here, just an unfulfilled promise
      }
    }
  }

  sendHelpMessage(msg) {
    let audio = '';
    let texts = '';
    let general = '';
    for (let command in this.commands) {
      if (!this.commands.hasOwnProperty(command)) {
        continue;
      }
      let type = this.commands[command].type;
      if (type === 'audio') {
        audio += command + ', ';
      } else if (type === 'text') {
        texts += command + ', ';
      } else {
        if (!(type === 'meme' || type === 'broken')) {
          general += command + ', ';
        }
      }
    }
    audio = audio.substr(0, audio.length - 2);
    texts = texts.substr(0, texts.length - 2);
    general = general.substr(0, general.length - 2);
    actions.sendMessage('Commands:\n\nGeneral:\n' + general + '\n\nAudio:\n' + audio + '\n\nText:\n' + texts + '\n\nMemes:\nmeme', msg.channel);
  }

  handleAudioCommand(command, msg) {
    if (!msg.guild) {
      msg.channel.send('You can\'t send voice commands from a PM');
      return;
    }

    const connection = actions.activeVoiceInGuild(this.bot.voiceConnections, msg.guild);
    const callback = () => {
      actions.playAudioCommand(this.bot.voiceConnections, command, null, connection);
    };
    if (!connection) {
      actions.joinChannel(this.bot.guilds, msg, null, callback);
    } else {
      try {
        let userVoiceChannelId = actions.getMessageVoiceChannelId(msg);
        if (userVoiceChannelId) {
          if (!actions.activeVoiceInGuild(this.bot.voiceConnections, msg.guild)) {
            actions.joinChannel(this.bot.guilds, msg, null, callback);
            return;
          }
          actions.playAudioCommand(this.bot.voiceConnections, command, userVoiceChannelId);
        } else {
          msg.channel.send('You must be in a voice channel to use voice commands');
        }
      } catch (e) {
        msg.channel.send('Failed to play audio command.');
        console.error('handleAudioCommand error: ' + e);
      }
    }
  }

  sendSubMessage(streamer) {
    let msg = (streamer.message ? streamer.message : streamer.name + ' is now live on twitch! https://www.twitch.tv/' + streamer.name);
    for (let server of streamer.servers) {
      actions.sendMessage(msg, this.bot.guilds.get(server.id).channels.get(server.channel));
    }
  }

  setConfigAndReset(data, channel, memes) {
    this.prefix = data.prefix;
    let tempMemes = this.commands.meme;
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
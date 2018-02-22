let Discord = require('discord.js');
let fs = require('fs');
const CONFIG_FILE = '../config.json';
const EventLogger = require('node-windows').EventLogger;
const log = new EventLogger('Mari Bot');

let bot;
let prefix, commands, token;
let dispatches = [];

setupBot();
readConfig(CONFIG_FILE, setConfig);

function setupBot() {
  bot = new Discord.Client();
  bot.on('ready', () => {
    log.info('Mari bot ready for combat!');
  });

  bot.on('message', msg => {
    let [importantBit] = msg.content.split(' ');
    importantBit = importantBit.toLowerCase();
    log.info('Received: ' + importantBit);
    for (let command in commands) {
      if (importantBit === prefix + command && commands.hasOwnProperty(command)) {
        handleCommand(commands[command], msg);
      }
    }
  });

  bot.on('voiceStateUpdate', (oldMember, newMember) => {
    if (bot.voice.connections.size === 0) {
      return;
    }
    if (oldMember && newMember) {
      if (oldMember.mute !== newMember.mute || oldMember.deaf !== newMember.deaf) {
        return;
      }
    }
    if (newMember && newMember.voiceChannel) {
      const voiceConnection = getBotVoiceConnection(newMember.voiceChannel.id);
      if (voiceConnection) {
        playAudioFile(getFileForCommand(commands['newphone']), newMember.voiceChannel.id, voiceConnection);
      }
    }
  });

  bot.on('error', (e) => {
    log.error('ERROR: ' + e);
    try {
      resetBot();
    } catch (e) {
      log.error('Could not reload the bot: ' + e);
      process.exit(1);
    }
  });
}

function resetBot(channel) {
  if (bot && bot.readyTimestamp) {
    bot.destroy().then(() => {
      bot.login(token);
    }).catch((reason) => {
      log.info('Failed to logout...?\n' + reason);
    });
  } else {
    bot.login(token).then(() => {
      if (channel) {
        channel.send('Reset complete!');
      }
    });
  }
}

function handleCommand(command, msg) {
  let type = command.type.toLowerCase();
  switch (type) {
    case 'audio':
      handleAudioCommand(command, msg);
      break;
    case 'stop':
      const id = getUserVoiceConnection(msg.guild, msg.author);
      if (dispatches[id]) {
        try {
          dispatches[id].end();
        } catch (e) {
          log.warn('uncaught exception in stop: ' + e);
          // nothing to do here, just an unfulfilled promise
        }
      }
      break;
    case 'text':
      msg.channel.send(command.response);
      break;
    case 'move':
      joinChannel(msg);
      break;
    case 'leave':
      const connection = getBotVoiceConnection(getMessageVoiceChannelId(msg));
      if (connection) {
        connection.disconnect();
      }
      break;
    case 'go':
      let channelName = msg.content.substring(4);
      log.info('Moving to: ' + channelName);
      joinChannel(null, channelName);
      break;
    case 'meme':
      let urls = command.urls.split(',');
      let url = urls[Math.floor(Math.random() * urls.length)];
      msg.channel.send(url);
      break;
    case 'help':
      sendHelpMessage(command, msg);
      break;
    case 'reset':
      readConfig(CONFIG_FILE, setConfig, msg.channel);
      break;
    default:
      msg.channel.send('Config\'s fucked. Yell at Taylor to fix it.');
      break;
  }
}

function sendHelpMessage(command, msg) {
  msg.channel.send('Commands: ');
  let commandMessage = '';
  for (let command in commands) {
    if (commands.hasOwnProperty(command) && !(command === 'broken')) {
      commandMessage += '\"' + command + '\"' + ': ' + commands[command].type + '\n';
    }
  }
  msg.channel.send(commandMessage);
}

function handleAudioCommand(command, msg) {
  if (!msg.guild) {
    msg.channel.send('You can\'t send voice commands from a PM');
    return;
  }

  const path = getFileForCommand(command);
  const channelId = getMessageVoiceChannelId(msg);
  const channel = getBotVoiceChannel(channelId);
  const callback = () => {
    playAudioFile(path, channelId);
  };
  if (!channel) {
    joinChannel(msg, path, callback);
  } else {
    try {
      let userVoiceChannelId = getMessageVoiceChannelId(msg);
      if (userVoiceChannelId) {
        if (!getBotVoiceChannel(userVoiceChannelId)) {
          joinChannel(msg, path, callback);
          return;
        }
        playAudioFile(path, userVoiceChannelId);
      } else {
        msg.channel.send('You must be in a voice channel to use voice commands');
      }
    } catch (e) {
      msg.channel.send('Failed to play audio command.');
      log.error('handleAudioCommand error: ' + e);
    }
  }
}

function getBotVoiceChannel(channelId) {
  for (let voiceConnection of bot.voice.connections.values()) {
    if (voiceConnection.channel.id === channelId) {
      return voiceConnection.channel;
    }
  }
  return null;
}

function getBotVoiceConnection(channelId) {
  for (let voiceConnection of bot.voice.connections.values()) {
    if (voiceConnection.channel.id === channelId) {
      return voiceConnection;
    }
  }
  return null;
}

function joinChannel(msg, channelNameOrId, callback) {
  if (!msg && !channelNameOrId) {
    log.info('How did this even happen?\njoinChannel requires either a message or a channel ID');
    return null;
  }
  if (!msg && channelNameOrId) {
    const channel = findChannel(channelNameOrId);
    if (channel) {
      channel.join().then(callback);
    } else {
      log.error('Unable to find channel with name/id ' + channelNameOrId);
    }
    return;
  }
  if (!msg.guild) {
    msg.channel.send('There\'s no guild attached to this message');
    return;
  }
  let voice = getUserVoiceConnection(msg.guild, msg.author);
  if (voice) {
    voice.join().then(callback);
  } else {
    msg.channel.send('The guild which contains that channel is currently unavailable.')
  }
}

function getUserVoiceConnection(guild, user) {
  if (!guild.available) {
    return null;
  }
  let guildUser = guild.member(user);
  return guildUser.voiceChannel;
}

function getMessageVoiceChannelId(msg) {
  if (!msg.guild) {
    return null;
  }
  return msg.guild.member(msg.author).voiceChannelID;
}

function getFileForCommand(command) {
  let files = command.files.split(',');
  let file = files[Math.floor(Math.random() * files.length)];
  file = file.trim();
  return command.folder + '/' + file + '.mp3';
}

function playAudioFile(file, channelId, vc) {
  const voiceConnection = vc ? vc : getBotVoiceConnection(channelId);
  if (!voiceConnection) {
    log.error('We don\'t have a voice connection to channel with id ' + channelId);
    return;
  }
  log.info('Playing: ' + file);
  dispatches[channelId] = voiceConnection.playFile(file);
  addDefaultErrorHandler(dispatches[channelId]);
  if (file.includes('Trilliax') || file.includes('MemeAudio')) {
    dispatches[channelId].setVolume(0.25);
  } else {
    dispatches[channelId].setVolume(1.5);
  }
}

function findChannel(nameOrId) {
  if (!nameOrId) {
    log.error('findChannel requires a name or id');
    return null;
  }
  let guilds = bot.guilds.array();
  for (let i = 0; i < guilds.length; i++) {
    if (!guilds[i].available) {
      log.warn('guild ' + guilds[i] + ' is unavailable at this time');
      continue;
    }
    let channels = guilds[i].channels.array();
    for (let j = 0; j < channels.length; j++) {
      if (channels[j].name === nameOrId || channels[j].id === nameOrId) {
        return channels[j];
      }
    }
  }
  return null;
}

function readConfig(path, callback, ...args) {
  fs.readFile(require.resolve(path), (err, data) => {
    if (err) {
      callback(err);
    } else {
      callback(null, JSON.parse(data), args);
      log.info("Read config");
    }
  });
}

function addDefaultErrorHandler(promise) {
  promise.on('Error', e => {
    log.error('Error in promise handling: ' + e);
  })
}

let config;

function setConfig(err, json, channel) {
  if (!err && json) {
    config = json;
    token = config.token;
    prefix = config.prefix;
    commands = config.commands;
    resetBot(channel);
  }
}
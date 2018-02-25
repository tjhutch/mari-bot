require('discord.js/src/structures/TextChannel');
let Discord = require('discord.js');
let fs = require('fs');
const CONFIG_FILE = '../config.json';
const TOKEN_FILE = '../token.json';
const Logging = require('./Logging.js');

const log = new Logging(!!process.argv[2]);

let bot;
let prefix, commands, token;

setupBot();
readToken(TOKEN_FILE);
readConfig(CONFIG_FILE);

function setupBot () {
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

function resetBot (channel) {
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

function handleCommand (command, msg) {
  let type = command.type.toLowerCase();
  switch (type) {
    case 'audio':
      handleAudioCommand(command, msg);
      break;
    case 'stop':
      let dispatcher = activeVoiceInGuild(msg.guild).dispatcher;
      if (dispatcher) {
        try {
          dispatcher.end();
        } catch (e) {
          log.warn('uncaught exception in stop: ' + e);
          // nothing to do here, just an unfulfilled promise
        }
      }
      break;
    case 'text':
      sendMessage(command.response, msg.channel);
      break;
    case 'move':
      joinChannel(msg);
      break;
    case 'leave':
      const connection = activeVoiceInGuild(msg.guild);
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
      sendMessage(url, msg.channel);
      break;
    case 'help':
      sendHelpMessage(msg);
      break;
    case 'reset':
      readConfig(CONFIG_FILE, msg.channel);
      break;
    default:
      sendMessage('Config\'s fucked. Yell at Taylor to fix it.', msg.channel);
      break;
  }
}

function sendHelpMessage (msg) {
  let audio = '';
  let texts = '';
  let help = '';
  for (let command in commands) {
    if (commands.hasOwnProperty(command) && commands[command].type === 'audio') {
      audio += command + ', ';
    } else if (commands[command].type === 'text') {
      texts += command + ', ';
    } else {
      if (!(commands[command].type === 'meme' || commands[command].type === 'broken')) {
        help += command + ', ';
      }
    }
  }
  audio = audio.substring(0, audio.length - 2);
  texts = texts.substring(0, texts.length - 2);
  help = help.substring(0, help.length - 2);
  sendMessage('Commands:\n\nHelp:\n' + help + '\n\nAudio:\n' + audio + '\n\nText:\n' + texts + '\n\nMemes:\nmeme', msg.channel);
}

function sendMessage (message, channel) {
  if (!(message && channel)) {
    log.info('bad message attempt. Message: ' + message + '\nchannel: ' + channel);
  }
  if (message.length > 2000) {
    channel.send(message.substring(0, 2000));
    channel.send(message.substring(2000));
  } else {
    channel.send(message);
  }
}

function handleAudioCommand(command, msg) {
  if (!msg.guild) {
    msg.channel.send('You can\'t send voice commands from a PM');
    return;
  }

  const path = getFileForCommand(command);
  const connection = activeVoiceInGuild(msg.guild);
  const callback = () => {
    playAudioFile(path, null, connection);
  };
  if (!connection) {
    joinChannel(msg, path, callback);
  } else {
    try {
      let userVoiceChannelId = getMessageVoiceChannelId(msg);
      if (userVoiceChannelId) {
        if (!activeVoiceInGuild(msg.guild)) {
          joinChannel(msg, path, callback);
          return;
        }
        playAudioFile(path, userVoiceChannelId);
      } else {
        msg.channel.send('You must be in a voice channel to use voice commands');
      }
    } catch (e) {
      msg.channel.send('Failed to play audio command.');
      console.error('handleAudioCommand error: ' + e);
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
    console.info('How did this even happen?\njoinChannel requires either a message or a channel ID');
    return null;
  }
  if (!msg && channelNameOrId) {
    const channel = findChannel(channelNameOrId);
    if (channel) {
      channel.join().then(callback);
      return;
    } else {
      log.error('Unable to find channel with name/id ' + channelNameOrId);
    }
    return;
  }
  if (!msg.guild) {
    sendMessage('There\'s no guild attached to this message', msg.channel);
    return;
  }
  let voice = getUserVoiceConnection(msg.guild, msg.author);
  if (voice) {
    voice.join().then(callback);
  } else {
    sendMessage('The guild which contains that channel is currently unavailable.', msg.channel);
  }
}

function getUserVoiceConnection (guild, user) {
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

function getFileForCommand (command) {
  let files = command.files.split(',');
  let file = files[Math.floor(Math.random() * files.length)];
  file = file.trim();
  return command.folder + '/' + file + '.mp3';
}

function playAudioFile(file, channelId, vc) {
  const voiceConnection = vc ? vc : getBotVoiceConnection(channelId);
  if (!voiceConnection) {
    console.error('We don\'t have a voice connection to channel with id ' + channelId);
    return;
  }
  console.info('Playing: ' + file);
  let dispatcher = voiceConnection.playFile(file);
  addDefaultErrorHandler(dispatcher);
  if (file.includes('Trilliax') || file.includes('MemeAudio')) {
    dispatcher.setVolume(0.25);
  } else {
    dispatcher.setVolume(1.5);
  }
}

function activeVoiceInGuild(guild) {
  let channels = guild.channels.array();
  for (let channel of channels) {
    let connection = getBotVoiceConnection(channel.id);
    if (connection) {
      return connection;
    }
  }
}

function findChannel (nameOrId) {
  if (!nameOrId) {
    console.error('findChannel requires a name or id');
    return null;
  }
  let guilds = bot.guilds.array();
  for (let i = 0; i < guilds.length; i++) {
    if (!guilds[i].available) {
      console.warn('guild ' + guilds[i] + ' is unavailable at this time');
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

function readConfig (path, channel) {
  fs.readFile(require.resolve(path), (err, data) => {
    if (err) {
      log.error("failed to read config file " + path);
      if (channel) {
        channel.send("Failed to update config");
      }
    } else {
      const json = JSON.parse(data);
      prefix = json.prefix;
      commands = json.commands;
      resetBot(channel);
    }
  });
}

function readToken(path) {
  fs.readFile(require.resolve(path), (err, json) => {
    if (err) {
      log.error('failed to read token');
      process.exit(1);
    } else {
      let data = JSON.parse(json);
      log.info("Read token");
      token = data.token;
    }
  });
}

function addDefaultErrorHandler (promise) {
  promise.on('Error', e => {
    log.error('Error in promise handling: ' + e);
  })
}

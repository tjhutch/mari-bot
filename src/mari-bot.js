require('discord.js/src/structures/TextChannel');
let Discord = require('discord.js');
let fs = require('fs');
const CONFIG_FILE = '../config.json';

let bot;
let prefix, commands, token;
let dispatches = [];

setupBot();
readConfig(CONFIG_FILE, setConfig);

function setupBot () {
  bot = new Discord.Client();
  bot.on('ready', () => {
    console.log('Mari bot ready for combat!');
  });

  bot.on('message', msg => {
    let [importantBit] = msg.content.split(' ');
    importantBit = importantBit.toLowerCase();
    console.log('Received: ' + importantBit);
    for (let command in commands) {
      if (importantBit === prefix + command && commands.hasOwnProperty(command)) {
        handleCommand(commands[command], msg);
      }
    }
  });

  bot.on('voiceStateUpdate', (oldMember, newMember) => {
    if (bot.voiceConnections.size === 0) {
      return;
    }
    if (oldMember && newMember) {
      if (oldMember.mute !== newMember.mute || oldMember.deaf !== newMember.deaf) {
        return;
      }
    }
    if (newMember && newMember.voiceChannel) {
      if (bot.voiceConnections.has(newMember.voiceChannel.id)) {
        playAudioFile(getFileForCommand(commands['newphone']), newMember.voiceChannel.id);
      }
    }
  });

  bot.on('error', (e) => {
    console.error('ERROR: ' + e);
    try {
      resetBot();
    } catch (e) {
      console.error('Could not reload the bot: ' + e);
      process.exit(1);
    }
  });
}

function resetBot (channel) {
  if (bot && bot.readyTimestamp) {
    bot.destroy().then(() => {
      bot.login(token);
    }).catch((reason) => {
      console.log('Failed to logout...?\n' + reason);
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
      if (dispatches[msg.channel.id]) {
        try {
          dispatches[msg.channel.id].end();
        } catch (e) {
          console.warn('uncaught exception in stop: ' + e);
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
      const channelId = getMessageVoiceChannelId(msg);
      if (bot.voiceConnections.has(channelId)) {
        bot.voiceConnections[channelId].disconnect();
      }
      break;
    case 'go':
      let channelName = msg.content.substring(4);
      console.log('Moving to: ' + channelName);
      joinChannel(null, channelName);
      break;
    case 'meme':
      let urls = command.urls.split(',');
      let url = urls[Math.floor(Math.random() * urls.length)];
      sendMessage(url, msg.channel);
      break;
    case 'help':
      sendHelpMessage(command, msg);
      break;
    case 'reset':
      readConfig(CONFIG_FILE, setConfig, msg.channel);
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
    console.log('bad message attempt. Message: ' + message + '\nchannel: ' + channel);
  }
  if (message.length > 2000) {
    channel.send(message.substring(0, 2000));
    channel.send(message.substring(2000));
  } else {
    channel.send(message);
  }
}

function handleAudioCommand (command, msg) {
  const path = getFileForCommand(command);
  try {
    let userVoiceChannelId = getMessageVoiceChannelId(msg);
    if (userVoiceChannelId) {
      if (!bot.voice.connections.has(userVoiceChannelId)) {
        joinChannel(msg, null, path);
      } else {
        playAudioFile(path, userVoiceChannelId);
      }
    } else {
      msg.channel.send('Sorry, you can\'t send voice commands when you\'re not in a channel');
    }
  } catch (ex) {
    //TODO: Decide how to handle this failure case
  }
}

function joinChannel (msg, channelNameOrId, audioFile) {
  if (!msg && !channelNameOrId) {
    console.log('How did this even happen?\njoinChannel requires either a message or a channel ID');
    return null;
  }
  if (channelNameOrId) {
    const channel = findChannel(channelNameOrId);
    if (channel) {
      channel.join().then(() => {
        if (audioFile) {
          playAudioFile(audioFile, channel.id);
        }
      });
    } else {
      console.error('Unable to find channel with name/id ' + channelNameOrId);
    }
  }
  if (!msg.guild) {
    sendMessage('There\'s no guild attached to this message', msg.channel);
    return;
  }
  let voice = getUserVoiceConnection(msg.guild, msg.author);
  if (voice) {
    voice.join().then(() => {
      if (audioFile) {
        playAudioFile(audioFile, voice.id);
      }
    });
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

function getMessageVoiceChannelId (msg) {
  return msg.guild.member(msg.author).voiceChannelID;
}

function getFileForCommand (command) {
  let files = command.files.split(',');
  let file = files[Math.floor(Math.random() * files.length)];
  file = file.trim();
  return command.folder + '/' + file + '.mp3';
}

function playAudioFile (file, channelId) {
  if (!bot.voiceConnections.has(channelId)) {
    joinChannel(null, channelId);
  }
  if (!bot.voiceConnections.has(channelId)) {
    console.error('unable to join channel with id ' + channelId);
    return;
  }
  console.log('Playing: ' + file);
  dispatches[channelId] = bot.voiceConnections[channelId].playFile(file);
  addDefaultErrorHandler(dispatches[channelId]);
  if (file.includes('Trilliax') || file.includes('MemeAudio')) {
    dispatches[channelId].setVolume(0.25);
  } else {
    dispatches[channelId].setVolume(1.5);
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

function readConfig (path, callback, ...args) {
  fs.readFile(require.resolve(path), (err, data) => {
    if (err) {
      callback(err);
    } else {
      callback(null, JSON.parse(data), args);
      console.log('Read config');
    }
  });
}

function addDefaultErrorHandler (promise) {
  promise.on('Error', e => {
    console.error('Error in promise handling: ' + e);
  });
}

let config;

function setConfig (err, json, channel) {
  if (!err && json) {
    config = json;
    token = config.token;
    prefix = config.prefix;
    commands = config.commands;
    resetBot(channel);
  }
}
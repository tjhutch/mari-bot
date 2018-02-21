let Discord = require('discord.js');
let fs = require('fs');
const CONFIG_FILE = '../config.json';

let bot;
let prefix, commands, token;
//let receiver = null;
let voiceConnection = null;
let dispatch = null;
let queue = [];

setupBot();
readConfig(CONFIG_FILE, setConfig);

function setupBot() {
  bot = new Discord.Client();
  bot.on('ready', () => {
    console.log('Mari bot ready for combat!');
    voiceConnection = getActiveVoiceConnection();
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
    if (oldMember && newMember && voiceConnection) {
      if (oldMember.mute !== newMember.mute || oldMember.deaf !== newMember.deaf) {
        return;
      }
    }
    if (newMember && newMember.voiceChannel && voiceConnection) {
      if (newMember.voiceChannel.name === voiceConnection.channel.name) {
        playAudioFile(getFileForCommand(commands['newphone']));
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

function resetBot(channel) {
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

function handleCommand(command, msg) {
  let type = command.type.toLowerCase();
  switch (type) {
    case 'audio':
      handleAudioCommand(command, msg);
      break;
    case 'stop':
      if (dispatch) {
        try {
          dispatch.end();
        } catch (e) {
          // nothing to do here, just an unfulfilled promise
        }
      }
      break;
    case 'text':
      msg.channel.send(command.response);
      break;
    case 'move':
      moveToChannel(msg);
      break;
    case 'leave':
      if (voiceConnection) {
        voiceConnection.disconnect();
        voiceConnection = null;
      }
      break;
    case 'go':
      let channelName = msg.content.substring(4);
      console.log('Moving to: ' + channelName);
      findAndMoveToChannel(channelName);
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
  let path = getFileForCommand(command);
  if (!voiceConnection) {
    moveToChannel(msg, path);
  } else {
    try {
      let userVoice = getUserVoiceConnection(msg.guild, msg.author);
      if (userVoice) {
        if (userVoice.channel.name !== voiceConnection.channel.name) {
          moveToChannel(msg, path);
        } else {
          playAudioFile(path);
        }
      }
    } catch (ex) {
      if (voiceConnection !== null) {
        playAudioFile(path);
      }
    }
  }
}

function moveToChannel(msg, file) {
  if (!msg.guild) {
    msg.channel.send('There\'s no guild attached to this message');
    return;
  }
  let voice = getUserVoiceConnection(msg.guild, msg.author);

  voice.join().then(connection => {
    if (voiceConnection) {
      voiceConnection.disconnect();
    }
    voiceConnection = connection;
    if (file) {
      playAudioFile(file);
    }
  });
}

function getUserVoiceConnection(guild, user) {
  let guildUser = guild.member(user);
  return guildUser.voiceChannel;
}

function getFileForCommand(command) {
  let files = command.files.split(',');
  let file = files[Math.floor(Math.random() * files.length)];
  file = file.trim();
  return command.folder + '/' + file + '.mp3';
}

function playFromQueue() {
  dispatch = null;
  let file = queue.splice(0, 1);
  if (file && !file.isEmpty()) {
    console.log('Queue playing: ' + file);
    playAudioFile(file);
  }
}

function playAudioFile(file) {
  if (!voiceConnection) {
    voiceConnection = getActiveVoiceConnection();
    if (!voiceConnection) {
      return;
    }
  }
  /*if (dispatch) {
      console.log('Queueing: ' + file);
      queue.push(file);
      return;
  }*/
  console.log('Playing: ' + file);
  dispatch = voiceConnection.playFile(file);
  if (file.includes('Trilliax') || file.includes('MemeAudio')) {
    dispatch.setVolume(0.25);
  } else {
    dispatch.setVolume(1.5);
  }
  //dispatch.on('end', playFromQueue);
}

function getActiveVoiceConnection() {
  let voiceManager = bot.voiceManager;
  if (voiceManager) {
    let connection = connections.first();
    if (connection) {
      return connection;
    }
  }

  return null;
}

function findAndMoveToChannel(channelName) {
  let guilds = bot.guilds.array();
  let found = false;
  for (let i = 0; i < guilds.length; i++) {
    let channels = guilds[i].channels.array();
    for (let j = 0; j < channels.length; j++) {
      if (channels[j].type === 'voice' && channels[i].name === channelName) {
        channels[j].join().then(connection => {
          if (voiceConnection) {
            voiceConnection.disconnect();
          }
          voiceConnection = connection;
        });
        found = true;
        break;
      }
    }
    if (found) {
      break;
    }
  }
}

function readConfig(path, callback, ...args) {
  fs.readFile(require.resolve(path), (err, data) => {
    if (err) {
      callback(err);
    } else {
      callback(null, JSON.parse(data), args);
      console.log("Read config");
    }
  });
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
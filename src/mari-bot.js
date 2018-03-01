const Discord = require('discord.js');
const Logger = require('./logger');
const TwitchWebhookHandler = require('./twitchWebhookHandler');
const ConfigManager = require('./configManager');

// init logger and config utility
const log = new Logger(!!process.argv[2]);
const config = new ConfigManager(log);

let bot;
let prefix, commands, token, commandsUpdated = false;

configureBot();
config.readToken().then((data) => {
  token = data.discordToken;
  // init twitch stream watcher
  //new TwitchWebhookHandler(log, data, config, sendSubMessage);
  return config.readConfig();
}).then(setConfigAndReset)
  .then(() => config.readMemes())
  .then((memes) => {
    commands.meme = memes;
  }).catch((e) => {
  log.error('failed while reading configuration file: ' + e);
  process.exit(1);
});

process.on('SIGINT', () => {
  // write new memes
  const fs = require('fs');
  const util = require('util');
  fs.writeFileSync("./config/memes.json", util.inspect(commands.meme), 'utf-8');
});

// sets all the handlers for bot actions
function configureBot () {
  bot = new Discord.Client();
  bot.on('ready', () => {
    log.info('Mari bot ready for combat!');
  });

  // handling of normal commands
  // check if we have a command like what's sent, then pass along to the handler function
  bot.on('message', msg => {
    // don't respond to your own messages
    if (msg.author.username === 'mari-bot') {
      return;
    }
    // storing memes for later use
    if (msg.guild.name === 'But Why Tho' && msg.channel.name === "spicy_memes") {
      if (isURL(msg.content)) {
        commands.meme.urls.push(msg.content);
        commandsUpdated = true;
      }
    }
    if (!msg.content.startsWith(prefix)) {
      return;
    }
    let [importantBit] = msg.content.split(' ');
    importantBit = importantBit.toLowerCase().slice(1);
    log.info('Received: ' + importantBit);
    for (let command in commands) {
      if (importantBit === command && commands.hasOwnProperty(command)) {
        handleCommand(commands[command], msg);
      }
    }
  });

  // NEW PHONE WHO DIS
  // play new phone audio clip when a new user comes into the same channel as the bot
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

  // Uh oh
  bot.on('Error', (e) => {
    log.error('ERROR bot crashed!: ' + e);
    try {
      resetBot();
    } catch (e) {
      log.error('Could not reset the bot: ' + e);
      process.exit(1);
    }
  });
}

function isURL(str) {
  const pattern = new RegExp('^(https?:\\/\\/)'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return pattern.test(str);
}

// Reset the bot (or start it if it's not already running)
// if channel is given, notify that channel when reset is complete
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

// breakout command types into their handler functions
function handleCommand (command, msg) {
  let type = command.type.toLowerCase();
  switch (type) {
    case 'audio':
      handleAudioCommand(command, msg);
      break;
    case 'stop':
      stopTalkingInGuild(msg.guild);
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
      const channelName = msg.content.substring(4);
      log.info('Moving to: ' + channelName);
      joinChannel(null, channelName);
      break;
    case 'meme':
      const urls = command.urls;
      let url = urls[Math.floor(Math.random() * urls.length)];
      sendMessage(url, msg.channel);
      break;
    case 'help':
      sendHelpMessage(msg);
      break;
    case 'reset':
      config.readConfig().then((data) => {
        setConfigAndReset(data, msg.channel);
      });
      break;
    default:
      sendMessage('Something\'s fucked. Yell at Taylor to fix it.', msg.channel);
      break;
  }
}

function setConfigAndReset(data, channel) {
  prefix = data.prefix;
  commands = data.commands;
  // start your engines!
  resetBot(channel);
}

function stopTalkingInGuild(guild) {
  let dispatcher = activeVoiceInGuild(guild).dispatcher;
  if (dispatcher) {
    try {
      dispatcher.end();
    } catch (e) {
      log.warn('uncaught exception in stop: ' + e);
      // nothing to do here, just an unfulfilled promise
    }
  }
}

function sendHelpMessage (msg) {
  let audio = '';
  let texts = '';
  let general = '';
  for (let command in commands) {
    if (!commands.hasOwnProperty(command)) {
      continue;
    }
    let type = commands[command].type;
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
  sendMessage('Commands:\n\nGeneral:\n' + general + '\n\nAudio:\n' + audio + '\n\nText:\n' + texts + '\n\nMemes:\nmeme', msg.channel);
}

function sendMessage (message, channel) {
  if (!(message && channel)) {
    log.info('bad message attempt. Message: ' + message + '\nchannel: ' + channel);
    return;
  }
  // discord maximum message length is 2000
  // if the message is too long, break it up into 2000 character chunks
  if (message.length > 2000) {
    channel.send(message.substr(0, 2000));
    for (let i = 2000; i < message.length; i += 2000) {
      channel.send(message.substr(i, 2000));
    }
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
  // attempt to join channel based on given channel name or ID
  if (!msg && channelNameOrId) {
    const channel = findChannel(channelNameOrId);
    if (channel) {
      channel.join().then(callback);
      return;
    } else {
      log.error('Unable to find channel with name/id ' + channelNameOrId);
    }
    return;
  } else if(!msg) {
    log.error('unable to join channel with \nmsg ' + msg + '\nchannel name/id' + channelNameOrId);
  }
  if (!msg.guild) {
    sendMessage('There\'s no guild attached to this message', msg.channel);
    return;
  }
  // attempt to join channel that the user who sent the message is currently in
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
  const files = command.files;
  if (!files) {
    log.error('No files attached to this command...?');
    return "";
  }
  const file = files[Math.floor(Math.random() * files.length)];
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
  dispatcher.on('Error', defaultErrorHandler);
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
    let channel = guilds[i].channels.filter(channel => channel.name === nameOrId || channel.id === nameOrId);
    if (channel && channel.size) {
      return channel.first();
    }
  }
  return null;
}

function sendSubMessage(streamer) {
  let msg = (streamer.message ? streamer.message : streamer.name + ' is now live on twitch! https://www.twitch.tv/' + streamer.name);
  for (let server of streamer.servers) {
    sendMessage(msg, bot.guilds.get(server.id).channels.get(server.channel));
  }
}

function defaultErrorHandler (e) {
  log.error('Error in promise handling: ' + e);
}

const utils = require('./utils');
const log = require('./logger').getLogger();

function getUserVoiceChannel(guild, user) {
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

function levelUpUser(guildLevels, guildSettings, user, channel) {
  // if user doesn't exist in levels tracking, add them
  if (!guildLevels[user.id]) {
    guildLevels[user.id] = {
      level: guildSettings.levels[0].name,
      messages: 1,
    };
    // skip if they're already max level
  } else if (!guildLevels[user.id].maxLevel) {
    let messages = guildLevels[user.id].messages + 1;
    let level;
    let maxLevel;
    for (let guildLevel of guildSettings.levels) {
      if (messages >= guildLevel.messagesRequired) {
        level = guildLevel.name;
        maxLevel = guildLevel.max;
      } else {
        break;
      }
    }
    // level up!
    if (guildLevels[user.id].level !== level) {
      let messageTemplate = maxLevel ? guildSettings.maxLvlMessage : guildSettings.levelUpMessage;
      sendMessage(messageTemplate.replace('<user>', user.username).replace('<level>', level), channel);
    }
    guildLevels[user.id] = {
      level,
      messages,
      maxLevel,
    };
  }
}

function getLevelOfUser(guildLevels, guildSettings, guildMembers, uName) {
  let userName = uName.toLowerCase();
  for (let member of guildMembers) {
    let user = member[1].user;
    if (userName === user.username.toLowerCase() || userName === member[1].nickname.toLowerCase()) {
      if (!guildLevels[user.id]) {
        guildLevels[user.id] = {
          level: guildSettings.levels[0].name,
          messages: 0,
        };
      }
      return guildLevels[user.id].level;
    }
  }
  return null;
}

function welcomeMember(member, guildSettings) {
  let name = '<@' + member.user.id + '>';
  sendMessage(guildSettings.welcomeMessage.replace('<user>', name), member.guild.channels.get(guildSettings.welcomeChannel));
}

function getFileForCommand(command) {
  const files = command.files;
  if (!files) {
    log.error('No files attached to this command...?');
    return '';
  }
  const file = files[Math.floor(Math.random() * files.length)];
  return `${command.folder}/${file}.mp3`;
}

function getVoiceInGuild(voiceConnections, guild) {
  let channels = guild.channels.array();
  for (let channel of channels) {
    let connection = getChannelVoice(channel.id, voiceConnections);
    if (connection) {
      return connection;
    }
  }
}

function findChannel(nameOrId, guilds) {
  if (!nameOrId) {
    console.error('findChannel requires a name or id');
    return null;
  }
  for (let guild of guilds) {
    if (!guild.available) {
      log.warn('guild ' + guild + ' is unavailable at this time');
      continue;
    }
    let channels = guild.channels.filter(channel => channel.name === nameOrId || channel.id === nameOrId);
    if (channels && channels.size) {
      return channels.first();
    }
  }
  return null;
}

function playAudioCommand(voiceConnections, command, channelId, vc) {
  const voiceConnection = vc ? vc : getChannelVoice(channelId, voiceConnections);
  const file = getFileForCommand(command);
  if (!voiceConnection) {
    console.error('We don\'t have a voice connection to channel with id ' + channelId);
    return;
  }
  console.info('Playing: ' + file);
  let volume = command.volume;
  if (!volume) {
    volume = file.includes('Trilliax') || file.includes('MemeAudio') ? 0.25 : 1.5;
  }
  let properties = {
    volume,
  };
  let dispatcher = voiceConnection.playFile(file, properties);
  dispatcher.on('error', utils.defaultErrorHandler);
}

// checks the list of voiceConnections for a connection to a channel with id channelId
function getChannelVoice(channelId, voiceConnections) {
  let connections = voiceConnections.filter(voiceConnection => voiceConnection.channel.id === channelId);
  return connections && connections.size ? connections.first() : null;
}

function joinChannel(guilds, msg, channelNameOrId, callback) {
  if (!msg && !channelNameOrId) {
    console.info('How did this even happen?\njoinChannel requires either a message or a channel ID');
    return null;
  }
  // attempt to join channel based on given channel name or ID
  if (!msg && channelNameOrId) {
    const channel = findChannel(channelNameOrId, guilds);
    if (channel) {
      channel.join().then(callback).then(() => {
        log.info('joined channel: ' + channel.name);
      }).catch(utils.defaultErrorHandler);
      return;
    } else {
      log.error('Unable to find channel with name/id ' + channelNameOrId);
    }
    return;
  } else if (!msg) {
    log.error('unable to join channel with \nmsg ' + msg + '\nchannel name/id' + channelNameOrId);
  }
  if (!msg.guild) {
    sendMessage('There\'s no guild attached to this message', msg.channel);
    return;
  }
  // attempt to join channel that the user who sent the message is currently in
  let voiceChannel = getUserVoiceChannel(msg.guild, msg.author);
  if (voiceChannel) {
    voiceChannel.join().then(callback).then(() => {
      log.info('joined channel: ' + voiceChannel.name);
    }).catch(utils.defaultErrorHandler);
  } else {
    sendMessage('The guild which contains that channel is currently unavailable.', msg.channel);
  }
}

function sendHelpMessage(msg, commands) {
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

function handleAudioCommand(command, msg, voiceConnections, guilds) {
  if (!msg.guild) {
    msg.channel.send('You can\'t send voice commands from a PM');
    return;
  }

  const connection = getVoiceInGuild(voiceConnections, msg.guild);
  const callback = () => {
    playAudioCommand(voiceConnections, command, null, connection);
  };
  if (!connection) {
    joinChannel(guilds, msg, null, callback);
  } else {
    try {
      let userVoiceChannelId = getMessageVoiceChannelId(msg);
      if (userVoiceChannelId) {
        if (!getVoiceInGuild(voiceConnections, msg.guild)) {
          joinChannel(guilds, msg, null, callback);
          return;
        }
        playAudioCommand(voiceConnections, command, userVoiceChannelId);
      } else {
        msg.channel.send('You must be in a voice channel to use voice commands');
      }
    } catch (e) {
      msg.channel.send('Failed to play audio command.');
      console.error('handleAudioCommand error: ' + e);
    }
  }
}

function stopTalkingInGuild(guild, voiceConnections) {
  let dispatcher = getVoiceInGuild(voiceConnections, guild).dispatcher;
  if (dispatcher) {
    try {
      dispatcher.end();
    } catch (e) {
      log.warn('uncaught exception in stop: ' + e);
    }
  }
}

function sendMessage(message, channel) {
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

module.exports = {
  getChannelVoice,
  getVoiceInGuild,
  playAudioCommand,
  joinChannel,
  getLevelOfUser,
  levelUpUser,
  welcomeMember,
  sendMessage,
  sendHelpMessage,
  handleAudioCommand,
  stopTalkingInGuild,
};

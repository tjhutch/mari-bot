const utils = require('./utils');
const logger = require('./logger').getLogger();

function sendMessage(message, channel) {
  if (!(message && channel)) {
    logger.log('info', `bad message attempt. Message: ${message}\nchannel: ${channel}`);
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
function getUserVoiceChannel(guild, user) {
  if (!guild.available) {
    return null;
  }
  const guildUser = guild.member(user);
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
    const messages = guildLevels[user.id].messages + 1;
    let level;
    let maxLevel;
    for (const guildLevel of guildSettings.levels) {
      if (messages >= guildLevel.messagesRequired) {
        level = guildLevel.name;
        maxLevel = guildLevel.max;
      } else {
        break;
      }
    }
    // level up!
    if (guildLevels[user.id].level !== level) {
      const messageTemplate = maxLevel ? guildSettings.maxLvlMessage : guildSettings.levelUpMessage;
      sendMessage(messageTemplate.replace('<user>', user.username).replace('<level>', level), channel);
      logger.log('info', `leveled up ${user.name} to level ${level}`)
    }
    guildLevels[user.id] = {
      level,
      messages,
      maxLevel,
    };
  }
}

function getLevelOfUser(guildLevels, guildSettings, guildMembers, uName) {
  const userName = uName.toLowerCase();
  for (const member of guildMembers) {
    const { user } = member[1];
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
  const name = `<@${member.user.id}>`;
  sendMessage(guildSettings.welcomeMessage.replace('<user>', name), member.guild.channels.get(guildSettings.welcomeChannel));
}

function getFileForCommand(command) {
  const { files } = command;
  if (!files) {
    logger.log('error', 'No files attached to this command...?');
    return '';
  }
  const file = files[Math.floor(Math.random() * files.length)];
  return `${command.folder}/${file}.mp3`;
}

function getVoiceInGuild(voiceConnections, guild) {
  if (!voiceConnections || !guild) {
    return null;
  }
  const channels = guild.channels.array();
  for (const channel of channels) {
    const connection = getChannelVoice(channel.id, voiceConnections);
    if (connection) {
      return connection;
    }
  }
  return null;
}

function findChannel(nameOrId, guilds) {
  if (!nameOrId) {
    logger.log('error', 'findChannel requires a name or id');
    return null;
  }
  for (const guild of guilds) {
    if (!guild.available) {
      logger.log('warn', `guild ${guild} is unavailable at this time`);
      continue;
    }
    const channels = guild.channels.filter(channel => channel.name === nameOrId || channel.id === nameOrId);
    if (channels && channels.size) {
      return channels.first();
    }
  }
  return null;
}

function playAudioCommand(voiceConnections, command, channelId, vc) {
  const voiceConnection = vc || getChannelVoice(channelId, voiceConnections);
  const file = getFileForCommand(command);
  if (!voiceConnection) {
    logger.log('error', `We don't have a voice connection to channel with id ${channelId}`);
    return;
  }
  logger.log('info', `Playing: ${file}`);
  let { volume } = command;
  if (!volume) {
    volume = file.includes('Trilliax') || file.includes('MemeAudio') ? 0.25 : 1.5;
  }
  const properties = {
    volume,
  };
  const dispatcher = voiceConnection.playFile(file, properties);
  dispatcher.on('error', utils.defaultErrorHandler);
}

// checks the list of voiceConnections for a connection to a channel with id channelId
function getChannelVoice(channelId, voiceConnections) {
  const connections = voiceConnections.filter(voiceConnection => voiceConnection.channel.id === channelId);
  return connections && connections.size ? connections.first() : null;
}

function attachConnectionEventHandlers(connection, channel) {
  connection.on('debug', (msg) => {
    logger.log('debug', `debug from voice connection: ${msg}`);
  });
  connection.on('failed', () => {
    logger.log('error', `Failed to connect to channel ${channel}`);
  });
  connection.on('reconnecting', () => {
    logger.log(`Disconnected from voice channel ${channel}, attempting to reconnect`);
  });
  connection.on('error', (err) => {
    logger.log('error', `Voice connection error in ${channel}: ${err}`)
  });
  connection.on('ready', () => {
    logger.log('info', `Voice connection ready in ${channel}`)
  });
}

function joinChannel(guilds, msg, channelNameOrId, callback) {
  if (!msg && !channelNameOrId) {
    logger.log('info', 'How did this even happen?\njoinChannel requires either a message or a channel ID');
    return;
  }
  // attempt to join channel based on given channel name or ID
  if (!msg && channelNameOrId) {
    const channel = findChannel(channelNameOrId, guilds);
    if (channel) {
      channel.join().then(callback).then((connection) => {
        logger.log('info', `joined channel: ${channel.name}`);
        attachConnectionEventHandlers(connection, channelNameOrId);
      }).catch(utils.defaultErrorHandler);
      return;
    }
    logger.log('error', `Unable to find channel with name/id ${channelNameOrId}`);

    return;
  } else if (!msg) {
    logger.log('error', `unable to join channel with \nmsg ${msg}\nchannel name/id${channelNameOrId}`);
  }
  if (!msg.guild) {
    sendMessage('There\'s no guild attached to this message', msg.channel);
    return;
  }
  // attempt to join channel that the user who sent the message is currently in
  const voiceChannel = getUserVoiceChannel(msg.guild, msg.author);
  if (voiceChannel) {
    voiceChannel.join().then(callback).then(() => {
      logger.log('info', `joined channel: ${voiceChannel.name}`);
    }).catch(utils.defaultErrorHandler);
  } else {
    sendMessage('The guild which contains that channel is currently unavailable.', msg.channel);
  }
}

function sendHelpMessage(msg, commands) {
  let audio = '';
  let texts = '';
  let general = '';
  for (const command in commands) {
    if (!commands.hasOwnProperty(command)) {
      continue;
    }
    const type = commands[command].type;
    if (type === 'audio') {
      audio += `${command}, `;
    } else if (type === 'text') {
      texts += `${command}, `;
    } else if (!(type === 'meme' || type === 'broken')) {
      general += `${command}, `;
    }
  }
  audio = audio.substr(0, audio.length - 2);
  texts = texts.substr(0, texts.length - 2);
  general = general.substr(0, general.length - 2);
  sendMessage(`Commands:\n\nGeneral:\n${general}\n\nAudio:\n${audio}\n\nText:\n${texts}\n\nMemes:\nmeme`, msg.channel);
}

function handleAudioCommand(command, msg, voiceConnections, guilds) {
  if (!msg.guild) {
    msg.channel.send('You can\'t send voice commands from a PM');
    return;
  }

  const connection = getVoiceInGuild(voiceConnections, msg.guild);
  const callback = (connection) => {
    playAudioCommand(voiceConnections, command, null, connection);
  };
  if (!connection) {
    joinChannel(guilds, msg, null, callback);
  } else {
    try {
      const userVoiceChannelId = getMessageVoiceChannelId(msg);
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
      console.error(`handleAudioCommand error: ${e}`);
    }
  }
}

function stopTalkingInGuild(guild, voiceConnections) {
  const dispatcher = getVoiceInGuild(voiceConnections, guild).dispatcher;
  if (dispatcher) {
    try {
      dispatcher.end();
    } catch (e) {
      logger.log('warn', `uncaught exception in stop: ${e}`);
    }
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

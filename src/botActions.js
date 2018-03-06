const utils = require('./utils');
const log = require('./logger').getLogger();

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
  const files = command.files;
  if (!files) {
    log.error('No files attached to this command...?');
    return '';
  }
  const file = files[Math.floor(Math.random() * files.length)];
  return command.folder + '/' + file + '.mp3';
}

function activeVoiceInGuild(bot, guild) {
  let channels = guild.channels.array();
  for (let channel of channels) {
    let connection = getBotVoiceConnection(channel.id, bot);
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
    let channel = guild.channels.filter(channel => channel.name === nameOrId || channel.id === nameOrId);
    if (channel && channel.size) {
      return channel.first();
    }
  }
  return null;
}

function playAudioFile(bot, file, channelId, vc) {
  const voiceConnection = vc ? vc : getBotVoiceConnection(channelId, bot);
  if (!voiceConnection) {
    console.error('We don\'t have a voice connection to channel with id ' + channelId);
    return;
  }
  console.info('Playing: ' + file);
  let dispatcher = voiceConnection.playFile(file);
  dispatcher.on('Error', utils.defaultErrorHandler);
  if (file.includes('Trilliax') || file.includes('MemeAudio')) {
    dispatcher.setVolume(0.25);
  } else {
    dispatcher.setVolume(1.5);
  }
}

function getBotVoiceConnection(channelId, bot) {
  for (let voiceConnection of bot.voice.connections.values()) {
    if (voiceConnection.channel.id === channelId) {
      return voiceConnection;
    }
  }
  return null;
}

function joinChannel(msg, channelNameOrId, callback) {
  let joinPromise;
  if (!msg && !channelNameOrId) {
    console.info('How did this even happen?\njoinChannel requires either a message or a channel ID');
    return null;
  }
  // attempt to join channel based on given channel name or ID
  if (!msg && channelNameOrId) {
    const channel = findChannel(channelNameOrId);
    if (channel) {
      joinPromise = channel.join().catch(utils.defaultErrorHandler);
      if (callback) {
        joinPromise.then(callback);
      }
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
  let voice = getUserVoiceConnection(msg.guild, msg.author);
  if (voice) {
    joinPromise = voice.join().catch(utils.defaultErrorHandler);
    if (callback) {
    joinPromise.then(callback);
    }
  } else {
    sendMessage('The guild which contains that channel is currently unavailable.', msg.channel);
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
  getMessageVoiceChannelId,
  getFileForCommand,
  getBotVoiceConnection,
  activeVoiceInGuild,
  playAudioFile,
  joinChannel,
  sendMessage
};

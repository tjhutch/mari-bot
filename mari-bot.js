var Discord = require("discord.js");
const config = require("./config.json");

var bot = new Discord.Client();
var prefix = config.prefix;
var commands = config.commands;
var receiver = null;
var voiceConnection = null;
var dispatch = null;
var queue = [];

bot.login(config.token);

bot.on('ready', () => {
	console.log('Mari bot ready for combat!');
	voiceConnection = getActiveVoiceConnection();
});

bot.on("message", msg => {
	var importantBit = msg.content.split(" ")[0];
	importantBit = importantBit.toLowerCase();
	console.log("Recieved: " + importantBit);
	for (var command in commands) {
		if (importantBit === prefix + command) {
			handleCommand(commands[command], msg);
		}
	}
});

bot.on("voiceStateUpdate", (oldMember, newMember) => {
	if (oldMember && newMember && voiceConnection) {
		if (oldMember.mute !== newMember.mute || oldMember.deaf !== newMember.deaf) {
			return;
		}
	}
	if (newMember && newMember.voiceChannel && voiceConnection) {
		if (newMember.voiceChannel.name === voiceConnection.channel.name) {
			playAudioFile(getFileForCommand(commands["newphone"]));
		}
	}
});

function handleCommand(command, msg) {
	var type = command.type.toLowerCase();
	switch(type) {
		case "audio":
			var path = getFileForCommand(command);
			if (!voiceConnection) {
				moveToChannel(msg, path);
			} else {
				try {
					var userVoice = getUserVoiceConnection(msg.guild, msg.author);
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
			break;
		case "stop":
			if (dispatch !== null) {
				try {
					dispatch.end();
				} catch (e) {
					// nothing to do here, just an unfulfilled promise
				}
			}
			break;
		case "text":
			msg.channel.sendMessage(command.response);
			break;
		case "move":
			moveToChannel(msg);
			break;
		case "leave":
			if (voiceConnection) {
				voiceConnection.disconnect();
				voiceConnection = null;
			}
			break;
		case "go":
			var channelName = msg.content.substring(4);
			console.log("Moving to: " + channelName);
			findAndMoveToChannel(channelName);
			break;
		case "meme":
			var urls = command.urls.split(",");
			var url = urls[Math.floor(Math.random()*urls.length)];
			msg.channel.sendMessage(url);
			break;
		case "help":
			msg.channel.sendMessage("Commands: ")
			var commandMessage = "";
			for (var command in commands) {
				if (!(command === "broken")) {
					commandMessage += "\"" + command + "\"" + ": " + commands[command].type + "\n";
				}
			}
			msg.channel.sendMessage(commandMessage);
			break;
		default:
			msg.channel.sendMessage("Config's fucked. Yell at Taylor or Bhaven to have them fix it.")
			break;
	}
}

function moveToChannel(msg, file) {
	if (msg.guild === null) {
		msg.channel.sendMessage("No guild attached to this message");
		return;
	}
	var voice = getUserVoiceConnection(msg.guild, msg.author);

	voice.join().then(connection => {
		if (voiceConnection ) {
			voiceConnection.disconnect;
		}
		voiceConnection = connection;
		if (file !== undefined) {
			playAudioFile(file);
		}
	});
}

function getUserVoiceConnection(guild, user) {
	var guildUser = guild.member(user);
	return guildUser.voiceChannel;
}

function getFileForCommand(command) {
	var files = command.files.split(",");
	var file = files[Math.floor(Math.random()*files.length)];
	file = file.trim();
	return command.folder + "/" + file + ".mp3";
}

function playFromQueue() {
	dispatch = null;
	var file = queue.splice(0, 1);
	if (file && !file.isEmpty()) {
		console.log("Queue playing: " + file);
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
		console.log("Queueing: " + file);
		queue.push(file);
		return;
	}*/
	console.log("Playing: " + file);
	dispatch = voiceConnection.playFile(file);
	if (file.includes("Trilliax") || file.includes("MemeAudio")) {
		dispatch.setVolume(0.25);
	} else {
		dispatch.setVolume(1.5);
	}
	//dispatch.on('end', playFromQueue);
}

function getActiveVoiceConnection() {
	var voiceManager = bot.voiceManager;
	if (voiceManager) {
		var connection = connections.first();
		if (connection) {
			return connection;
		}
	}
	
	return null;
}

function findAndMoveToChannel(channelName) {
	var guilds = bot.guilds.array();
	var found = false;
	for (var i = 0; i < guilds.length; i++) {
	 	var channels = guilds[i].channels.array();
	 	for (var i = 0; i < channels.length; i++) {
	 		if (channels[i].type === "voice" && channels[i].name === channelName) {
	 			channels[i].join().then(connection => {
					if (voiceConnection ) {
						voiceConnection.disconnect;
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
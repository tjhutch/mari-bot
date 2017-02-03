var Discord = require("discord.js");
const config = require("./config.json");
const js = require('fs');

var bot = new Discord.Client();
var prefix = config.prefix;
var commands = config.commands;
var receiver = null;
var voiceConnection = null;
var dispatch = null;

bot.login(config.token);

bot.on("message", msg => {
	for (var command in commands) {
		if (msg.content.startsWith(prefix + command)) {
			handleCommand(commands[command], msg);
		}
	}
});

function handleCommand(command, msg) {
	var type = command.type.toLowerCase();
	switch(type) {
		case "audio":
			var files = command.files.split(",");
			var file = files[Math.floor(Math.random()*files.length)];
			var path = command.folder + "/" + file + ".mp3";
			console.log(path);
			if (voiceConnection === undefined || voiceConnection === null) {
				moveToChannel(msg, path);
			} else {
				try {
					var voice = getUserActiveVoiceChannel(msg.guild, msg.author);
					if (voice !== undefined && voice !== null) {
						if (voice.channel.name !== voiceConnection.channel.name) {
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
					//nothing to do here, just a rejected promise
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
			voiceConnection.disconnect();
			voiceConnection = null;
			break;
		case "meme":
			var files = fs.readdirSync("./Memes");
			var file = files[Math.floor(Math.random()*files.length)];
			//TODO: Figure how to send a file (or replace these with links)
			msg.channel.sendMessage("I haven't learned to meme properly yet");
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
	var voice = getUserActiveVoiceChannel(msg.guild, msg.author);

	voice.join().then(connection => {
		if (!(voiceConnection === null || voiceConnection === undefined)) {
			voiceConnection.disconnect;
		}
		voiceConnection = connection;
		if (file !== undefined) {
			playAudioFile(file);
		}
	});
}

function getUserActiveVoiceChannel(guild, user) {
	var guildUser = guild.member(user);
	return guildUser.voiceChannel;
}

bot.on('ready', () => {
	console.log('Mari bot ready for combat!');
});

bot.on("voiceStateUpdate", (oldMember, newMember) => {
	if (!(voiceConnection === null || voiceConnection === undefined 
		|| newMember.voiceChannel === undefined || oldMember.voiceChannel === undefined)) {
		if (newMember.voiceChannel.name === voiceConnection.channel.name 
			&& newMember.voiceChannel.name !== oldMember.voiceChannel.name) {
			var command = commands["newphone"];
			var files = command.files.split(",");
			var file = files[Math.floor(Math.random()*files.length)];
			var path = command.folder + "/" + file + ".mp3";
			playAudioFile(path);
		}
	}
});

function playAudioFile(file) {
	dispatch = voiceConnection.playFile(file);
}




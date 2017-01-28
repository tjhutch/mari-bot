var Discord = require("discord.js");
const config = require("./config.json");
const js = require('fs');

var bot = new Discord.Client();
var prefix = config.prefix;
var commands = config.commands;
var receiver = null;
var voiceConnection = null;

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
			
			if (voiceConnection === null) {
				moveToChannel(msg, path);
			} else {
				voiceConnection.playFile(path);
			}
			break;
		case "text":
			msg.channel.sendMessage(command.response);
			break;
		case "move":
			moveToChannel(msg);
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
	var guildUser = msg.guild.member(msg.author);
	guildUser.voiceChannel.join().then(connection => {
		if (!(voiceConnection === null || voiceConnection === undefined)) {
			voiceConnection.disconnect;
		}
		voiceConnection = connection;
		if (file !== undefined) {
			voiceConnection.playFile(file);
		}
	});
}

bot.on('ready', () => {
	console.log('I am ready!');
});

bot.on("voiceStateUpdate", (oldMember, newMember) => {
	if (!(voiceConnection === null || voiceConnection === undefined)) {
		if (newMember.voiceChannel.name === voiceConnection.channel.name) {
			var command = commands["newPhone"];
			var files = command.files.split(",");
			var file = files[Math.floor(Math.random()*files.length)];
			var path = command.folder + "/" + file + ".mp3";
			voiceConnection.playFile(path);
		}
	}
});




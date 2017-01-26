var Discord = require("discord.js");
const config = require("./config.json");

var bot = new Discord.Client();
var prefix = config.prefix;
var commands = config.commands;
var receiver = null;
var voiceConnection = null;

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
			//TODO: create audio handler
			var file = command.files.split(", ")[0];
			var path = "C:\\Repos\\mari-bot\\" + command.folder + "\\" + file;
			if (voiceConnection === null) {
				msg.channel.sendMessage("connection was not active");
				break;
			}
			voiceConnection.playFile(path);
			break;
		case "text":
			msg.channel.sendMessage(command.response);
			break;
		case "move":
			moveToChannel(msg);
			break;
		default:
			msg.channel.sendMessage("Sorry, there's something wrong with the config for that command. Please contact Taylor or Bhaven and yell at them to fix it.")
			break;
	}
}

function moveToChannel(msg) {
	if (msg.guild === null) {
		msg.channel.sendMessage("No guild attached to this message");
		return;
	}
	var guildUser = msg.guild.member(msg.author);
	guildUser.voiceChannel.join().then(connection => {
		if (!(receiver === null || receiver === undefined)) {
			receiver.destroy;
		}
		const dispatcher = connection.playFile("C:\\Repos\\mari-bot\\MariRecordings\\yeeeeuh.wav");
		dispatcher.ac
		voiceConnection = connection;
 		receiver = connection.createReceiver();
	})
	.catch(console.error);
}

bot.on('ready', () => {
	console.log('I am ready!');
});

// user joins server
//bot.on("guildMemberAdd", (member) => {
//	console.log(`New User "${member.user.username}" has joined "${member.guild.name}"`);
//	member.guild.defaultChannel.sendMessage(`"${member.user.username}" has joined this server`);
//});



bot.login(config.token);

var Discord = require("discord.js");
const config = require("./config.json");

var bot = new Discord.Client();
var prefix = config.prefix;

bot.on("message", msg => {
	if (msg.content.startsWith(prefix + "ping")) {
		msg.channel.sendMessage("pong!");
	} else if (msg.content.startsWith(prefix + "ayy")) {
		msg.channel.sendMessage("ayy lmao");
	}
});


bot.on('ready', () => {
	console.log('I am ready!');
});

// user joins server
bot.on("guildMemberAdd", (member) => {
	console.log(`New User "${member.user.username}" has joined "${member.guild.name}"`);
	member.guild.defaultChannel.sendMessage(`"${member.user.username}" has joined this server`);
});



bot.login(config.token);

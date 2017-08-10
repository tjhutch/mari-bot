let Discord = require("discord.js");
let fs = require("fs");

let bot = new Discord.Client();
let prefix = config.prefix;
let commands = config.commands;
//let receiver = null;
let voiceConnection = null;
let dispatch = null;
let queue = [];

function readConfig(path, cb) {
    fs.readFile(require.resolve(path), (err, data) => {
        if (err) {
            cb(err);
        } else {
            cb(null, JSON.parse(data))
        }
    })
}

let config;

readConfig("./config.json", (err, json) => {
    if (!err && json) {
        config = json;
        bot.login(config.token);
    }
});

bot.on('ready', () => {
    console.log('Mari bot ready for combat!');
    voiceConnection = getActiveVoiceConnection();
});

bot.on("message", msg => {
    let importantBit = msg.content.split(" ")[0];
    importantBit = importantBit.toLowerCase();
    console.log("Received: " + importantBit);
    for (let command in commands) {
        if (importantBit === prefix + command && commands.hasOwnProperty(command)) {
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
    let type = command.type.toLowerCase();
    switch (type) {
        case "audio":
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
            break;
        case "stop":
            if (dispatch) {
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
            let channelName = msg.content.substring(4);
            console.log("Moving to: " + channelName);
            findAndMoveToChannel(channelName);
            break;
        case "meme":
            let urls = command.urls.split(",");
            let url = urls[Math.floor(Math.random() * urls.length)];
            msg.channel.sendMessage(url);
            break;
        case "help":
            msg.channel.sendMessage("Commands: ");
            let commandMessage = "";
            for (let command in commands) {
                if (commands.hasOwnProperty(command) && !(command === "broken")) {
                    commandMessage += "\"" + command + "\"" + ": " + commands[command].type + "\n";
                }
            }
            msg.channel.sendMessage(commandMessage);
            break;
        case "refresh":
            readConfig("./config.json", (err, json) => {
                if (!err && json) {
                    config = json;
                }
            });
            break;
        default:
            msg.channel.sendMessage("Config's fucked. Yell at Taylor to fix it.")
            break;
    }
}

function moveToChannel(msg, file) {
    if (msg.guild === null || msg.guild === undefined) {
        msg.channel.sendMessage("There's no guild attached to this message");
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
    let files = command.files.split(",");
    let file = files[Math.floor(Math.random() * files.length)];
    file = file.trim();
    return command.folder + "/" + file + ".mp3";
}

function playFromQueue() {
    dispatch = null;
    let file = queue.splice(0, 1);
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
            if (channels[j].type === "voice" && channels[i].name === channelName) {
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
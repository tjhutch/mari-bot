const TwitchWebhookHandler = require('./twitchWebhookHandler');
const ConfigManager = require('./configManager');
const Bot = require('./bot');

// init logger and config utility
const log = require('./logger').getLogger();
const config = new ConfigManager(log);

let bot;
let commandsUpdated = false;
let twitch;
let saved = false;

// values[0] = commands
// values[1] = memes
// values[2] = tokens
// values[3] = guild permissions
Promise.all([config.readCommands(), config.readMemes(), config.readToken(), config.readGuildPermissions()]).then((values) => {
  values[0].meme = values[1];
  bot = new Bot(values[0], values[2].discordToken, values[3], config);
  twitch = new TwitchWebhookHandler(values[2], config, bot.sendSubMessage);
});

process.on('SIGINT', onExit);
process.on('SIGTERM', onExit);
process.on('exit', onExit);

function onExit() {
  if (!saved) {
    if (commandsUpdated) {
      config.saveMemes(bot.commands.meme);
      log.info('saved memes');
    }
    if (twitch) {
      twitch.unsubFromAll();
    }
    saved = true;
  }
  process.exit(0);
}


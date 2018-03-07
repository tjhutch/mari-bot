const TwitchWebhookHandler = require('./twitchWebhookHandler');
const config = require('./configManager').getConfigManager();
const Bot = require('./bot');

// init logger and config utility
const log = require('./logger').getLogger();

let bot;
let twitch;
let saved = false;

// values[0] = commands
// values[1] = memes
// values[2] = tokens
// values[3] = guild settings
// values[4] = guild levels
Promise.all([config.readCommands(),
             config.readMemes(),
             config.readTokens(),
             config.readGuildSettings(),
             config.readGuildLevels()]).then((values) => {
  values[0].meme = values[1];
  bot = new Bot(values[0], values[2].discordToken, values[3], values[4]);
  twitch = new TwitchWebhookHandler(values[2], bot.sendSubMessage);
});

process.on('SIGINT', onExit);
process.on('SIGTERM', onExit);
process.on('exit', onExit);

function onExit() {
  if (!saved) {
    if (bot.commandsUpdated) {
      config.saveMemes(bot.commands.meme);
      log.info('saved memes');
    }
    config.saveGuildLevels(bot.guildLevels);
    if (twitch) {
      twitch.unsubFromAll();
    }
    saved = true;
  }
  process.exit(0);
}


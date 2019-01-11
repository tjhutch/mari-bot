const TwitchWebhookHandler = require('./twitchWebhookHandler');
const config = require('./configManager').getConfigManager();
const Bot = require('./bot');
const log = require('./logger').getLogger();

let bot;
let twitch;
let saved = false;

Promise.all([config.readCommands(),      // values[0]
             config.readMemes(),         // values[1]
             config.readTokens(),        // values[2]
             config.readGuildSettings(), // values[3]
             config.readGuildLevels(),   // values[4]
]).then((values) => {
  values[0].commands.meme = values[1];
  bot = new Bot(values[0], values[2].discordToken, values[3], values[4]);
  twitch = new TwitchWebhookHandler(values[2], bot);
});

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

process.on('SIGINT', onExit);
process.on('SIGTERM', onExit);
process.on('exit', onExit);

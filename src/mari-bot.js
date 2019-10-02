// const TwitchWebhookHandler = require('./twitchWebhookHandler');
const config = require('./configManager').getConfigManager();
const Bot = require('./bot');
const logger = require('./logger').getLogger();

let bot;
let twitch;
let saved = false;


async function startBot() {
  const commands = await config.readCommands();
  const memes = await config.readMemes();
  const tokens = await config.readTokens();
  const guildSettings = await config.readGuildSettings();
  const guildLevels = await config.readGuildLevels();
  commands.commands.meme = memes;
  bot = new Bot(commands, tokens.discordToken, guildSettings, guildLevels);
  // twitch = new TwitchWebhookHandler(tokens, bot);
}

function onExit() {
  if (!saved) {
    if (bot.commandsUpdated) {
      config.saveMemes(bot.commands.meme);
      logger.log('info', 'saved memes');
    }
    config.saveGuildLevels(bot.guildLevels);
    logger.log('info', 'Saved guild levels');
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

startBot();

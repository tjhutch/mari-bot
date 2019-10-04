import Bot from 'Bot';
import LoggerFactory from 'src/Logger';
import TwitchWebhookHandler from 'TwitchWebhookHandler';
import ConfigManager from 'ConfigManager';
import CommandConfig from 'config/CommandConfig';

const logger = LoggerFactory.getLogger();

let bot;
let twitch;
let saved = false;

function twitchEnabled() {
  if (process.argv) {
    for (const value of process.argv) {
      if (/^(--twitch-notifications|-t)/.test(value)) {
        return true;
      }
    }
  }
}

function onExit() {
  if (!saved) {
    if (bot.memesUpdated) {
      ConfigManager.saveMemes(bot.commands.meme);
      logger.log('info', 'saved Memes');
    }
    if (bot.commandsUpdated) {
      delete bot.commands.meme;
      CommandConfig.commands = bot.commands;
      ConfigManager.saveCommands(CommandConfig);
    }
    ConfigManager.saveGuildLevels(bot.guildLevels);
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
bot = new Bot();
if (twitchEnabled()) {
  twitch = new TwitchWebhookHandler(bot);
}

const fs = require('fs');
const GUILD_LEVELS = './config/guildLevels.json';
const COMMANDS = './config/commands.json';
const TOKENS = './config/tokens.json';
const TWITCH_STREAMERS = './config/twitchStreamers.json';
const MEMES = './config/memes.json';
const GUILD_SETTINGS = './config/guildSettings.json';

class ConfigManager {
  readCommands() {
    return this.readFile(COMMANDS);
  }

  readTokens() {
    return this.readFile(TOKENS);
  }

  readStreamers() {
    return this.readFile(TWITCH_STREAMERS);
  }

  readMemes() {
    return this.readFile(MEMES);
  }

  readGuildSettings() {
    return this.readFile(GUILD_SETTINGS);
  }

  readGuildLevels() {
    return this.readFile(GUILD_LEVELS);
  }

  saveMemes(memes) {
    const fs = require('fs');
    fs.writeFileSync(MEMES, JSON.stringify(memes, null, 2), 'utf-8');
  }

  saveGuildLevels(guildLevels) {
    const fs = require('fs');
    fs.writeFileSync(GUILD_LEVELS, JSON.stringify(guildLevels, null, 2), 'utf-8');
  }

  readFile(path) {
    return new Promise((resolve, reject) => {
      fs.readFile(path, null, (e, json) => {
        if (e) {
          reject(e);
        } else {
          resolve(JSON.parse(json));
        }
      });
    });
  }
}

const manager = new ConfigManager();

function getConfigManager() {
  return manager;
}

// exporting this instead of the class makes my IDE realize that the class methods exist
module.exports = {
  getConfigManager
};
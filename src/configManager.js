const fs = require('fs');

class ConfigManager {
  readCommands() {
    return this.readFile('./config/commands.json');
  }

  readTokens() {
    return this.readFile('./config/tokens.json');
  }

  readStreamers() {
    return this.readFile('./config/twitchStreamers.json');
  }

  readMemes() {
    return this.readFile('./config/memes.json');
  }

  readGuildPermissions() {
    return this.readFile('./config/guildPermissions.json');
  }

  saveMemes(memes) {
    const fs = require('fs');
    fs.writeFileSync('./config/memes.json', JSON.stringify(memes, null, 2), 'utf-8');
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
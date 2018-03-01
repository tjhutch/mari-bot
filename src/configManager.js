const fs = require('fs');
let log;

module.exports = class ConfigManager {
  constructor(logger) {
    log = logger;
  }

// Get or reload configuration from config json file
// only reloads commands, not streamers or token info

  readConfig() {
    return this.readFile('./config/commands.json');
  };

  readToken() {
    return this.readFile('./config/tokens.json');
  };

  readStreamers() {
    return this.readFile('./config/twitchStreamers.json');
  }

  readMemes() {
    return this.readFile('./config/memes.json')
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
};
const fs = require('fs');
let log;

module.exports = class ConfigManager {
  constructor(logger) {
    log = logger;
  }

// Get or reload configuration from config json file
// only reloads commands, not streamers or token info

  readConfig() {
    return new Promise((resolve, reject) => {
      fs.readFile(require.resolve('config/commands.json'), (e, data) => {
        if (e) {
          reject(e);
        } else {
          const json = JSON.parse(data);
          resolve(json);
        }
      });
    });
  };

  readToken() {
    return new Promise((resolve, reject) => {
      fs.readFile(require.resolve('config/token.json'), (e, json) => {
        if (e) {
          log.error('failed to read tokens');
          reject(e);
        } else {
          let data = JSON.parse(json);
          log.info('Read token');
          resolve(data);
        }
      });
    });
  };

  readStreamers() {
    return new Promise((resolve, reject) => {
      fs.readFile('config/twitchStreamers.json', null, (e, json) => {
        if (e) {
          log.error('failed to read twitch streamers');
          reject(e);
        } else {
          let streamers = JSON.parse(json);
          log.info('Read twitch streamers');
          resolve(streamers);
        }
      });
    });
  }
};
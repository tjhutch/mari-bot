const TwitchWebhook = require('twitch-webhook');
const fs = require('fs');
const localTunnel = require('localtunnel');
let log;

module.exports = function Twitch(logger, tokenData, subCallback) {
  log = logger;
  this.secret = tokenData.twitchToken;
  this.clientId = tokenData.twitchClientId;
  this.callbackUrl = getCallbackUrl();

  this.getStreamers = function(resolve, reject) {
    fs.readFile('../twitchStreamers.json', null, (e, json) => {
      if (e) {
        log.error('failed to read twitch streamers');
        reject(e);
      } else {
        let streamers = JSON.parse(json);
        delete streamers[0]; // this object is just a comment for organization, delete for easier processing
        log.info('Read twitch streamers');
        resolve(streamers);
      }
    });
  };

  this.startTunnel = function(resolve, reject) {
    localTunnel('8492', { subdomain: 'maribot' }, (e, tunnel) => {
      if (e) {
        log.info('failed to connect to local tunnel: ' + e);
        reject(e);
      } else {
        log.info('Tunnel connected at url ' + tunnel.url);
        this.callbackUrl = tunnel.url;
        resolve(tunnel);
      }
    });
  };

  this.subscribeToStreams = function () {
    const twitchWebhook = new TwitchWebhook({
      client_id: this.clientId,
      callback: this.callbackUrl,
      secret: this.secret,
      listen: {
        port: '8492',
        host: '127.0.0.1',    // default: 0.0.0.0
        autoStart: false      // default: true
      }
    });

// set listener for all topics
    twitchWebhook.on('*', ({ topic, options, endpoint, event }) => {
      // topic name, for example "streams"
      log.info(topic);
      // topic options, for example "{user_id: 12826}"
      log.info(options);
      // full topic URL, for example
      // "https://api.twitch.tv/helix/streams?user_id=12826"
      log.info(endpoint);
      // topic data, timestamps are automatically converted to Date
      log.info(event);
    });

    // set listener for topic
    twitchWebhook.on('streams', ({ topic, options, endpoint, event }) => {
      log.info(event);

    });

    // subscribe to topic
    for (let streamer of this.streamers) {
      // first will be undefined since we deleted it
      if (!streamer) {
        continue;
      }
      twitchWebhook.subscribe('streams', {
        user_id: streamer.id
      });
    }

    // renew the subscription when it expires
    twitchWebhook.on('unsubscribe', (obj) => {
      twitchWebhook.subscribe(obj['hub.topic']);
    });

    // tell Twitch that we no longer listen
    // otherwise it will try to send events to a down app
    process.on('SIGINT', () => {
      // unsubscribe from all topics
      twitchWebhook.unsubscribe('*');
      process.exit(0);
    });
    log.info("Subscribed to streams");
  };

  new Promise(this.getStreamers).then((streamers) => {
    log.info("Got streamers");
    this.streamers = streamers;
  //  return new Promise(this.startTunnel);
  //}).then((tunnel) => {
  //  log.info("Tunnel created");
  //  this.tunnel = tunnel;
    this.subscribeToStreams();
  }).catch((e) => {
    log.error('Error while setting up twitch client: ' + e);
  });
};

function getCallbackUrl() {
  if (process.argv) {
    for (let value of process.argv) {
      if (/^--url/.test(value)) {
        return value.split('=')[1];
      }
    }
  }
}
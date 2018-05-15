const TwitchWebhook = require('twitch-webhook');
const ngrok = require('ngrok');
const log = require('./logger').getLogger();
const config = require('./configManager').getConfigManager();

const streamUpTimes = {};
let twitchWebhook;

function resubToUser(streamer) {
  const subObject = {
    user_id: streamer.id,
  };
  twitchWebhook.unsubscribe('streams', subObject).then(() => {
    twitchWebhook.subscribe('streams', subObject).then(() => {
      log.info(`re-subbed to ${subObject.user_id}'s stream`);
    }).catch((e) => {
      log.error(`failed to sub to ${subObject.user_id}'s stream: ${e}`);
    });
  }).catch((e) => {
    log.error(`failed to unsub from ${subObject.user_id}'s stream: ${e}`);
  });
}

module.exports = class TwitchWebhookHandler {
  constructor(tokenData, bot) {
    this.secret = tokenData.twitchToken;
    this.clientId = tokenData.twitchClientId;
    this.bot = bot;

    config.readStreamers().then((streamers) => {
      this.streamers = streamers;
      return new Promise(this.startTunnel);
    }).then((url) => {
      log.info('Tunnel created');
      this.callbackUrl = url;
      this.subscribeToStreams();
    }).catch((e) => {
      log.error(`Error while setting up twitch webhooks: ${e}`);
    });
  }

  startTunnel(resolve, reject) {
    ngrok.connect(8492, (e, url) => {
      if (e) {
        log.info(`failed to connect to ngrok: ${e}`);
        reject(e);
      } else {
        log.info(`ngrok connected at url ${url}`);
        resolve(url);
      }
    });
  }

  subscribeToStreams() {
    twitchWebhook = new TwitchWebhook({
      client_id: this.clientId,
      callback: this.callbackUrl,
      secret: this.secret,
      listen: {
        port: '8492',
        host: '127.0.0.1', // default: 0.0.0.0
        autoStart: true, // default: true
      },
    });

    // set listener for all topics
    // twitchWebhook.on('*', ({ topic, options, endpoint, event }) => {
    // topic name, for example "streams"
    // log.info(topic);
    // topic options, for example "{user_id: 12826}"
    // log.info(options);
    // full topic URL, for example
    // "https://api.twitch.tv/helix/streams?user_id=12826"
    // log.info(endpoint);
    // topic data, timestamps are automatically converted to Date
    // log.info(event);
    // });

    // set listener for topic
    twitchWebhook.on('streams', ({
      topic, options, endpoint, event,
    }) => {
      log.info(topic);
      log.info(options);
      log.info(endpoint);
      log.info(event);
      const [streamer] = this.streamers.filter(st => st.id === options.user_id);
      if (event.data && event.data.length) {
        const [data] = event.data;
        const startedAt = data.started_at;
        if (!streamUpTimes[streamer.id] || streamUpTimes[streamer.id] !== startedAt) {
          this.bot.sendSubMessage(streamer);
          streamUpTimes[streamer.id] = startedAt;
        } else {
          log.info(`Stream down: ${options.user_id}`);
          streamUpTimes[options.user_id] = null;
        }
      }
      resubToUser(streamer);
    });

    // subscribe to topic
    this.streamers.every((streamer) => {
      twitchWebhook.subscribe('streams', {
        user_id: streamer.id,
      });
      return true;
    });

    // renew the subscription when it expires
    twitchWebhook.on('unsubscribe', (obj) => {
      twitchWebhook.subscribe(obj['hub.topic']);
      log.warn(`Got unsubbed from a stream, resubbing ${obj}`);
    });

    log.info('Subscribed to streams');
  }

  // tell TwitchWebhookHandler that we no longer listen otherwise it will try to send events to a down app
  // this will be called from mari-bot default on exit handling method
  unsubFromAll() {
    if (twitchWebhook) {
      twitchWebhook.unsubscribe('*');
    }
    log.info('Unsubbed from all twitch hooks');
    ngrok.disconnect();
    ngrok.kill();
    log.info('killed ngrok');
  }
};

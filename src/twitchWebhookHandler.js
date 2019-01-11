const TwitchWebhook = require('twitch-webhook');
const ngrok = require('ngrok');
const logger = require('./logger').getLogger();
const config = require('./configManager').getConfigManager();

let twitchWebhook;

module.exports = class TwitchWebhookHandler {
  constructor(tokenData, bot) {
    this.secret = tokenData.twitchToken;
    this.clientId = tokenData.twitchClientId;
    this.bot = bot;

    config.readStreamers().then((streamers) => {
      this.streamers = streamers;
      return new Promise(this.startTunnel);
    }).then((url) => {
      logger.log('info', 'Tunnel created');
      this.callbackUrl = url;
      this.subscribeToStreams();
    }).catch((e) => {
      logger.log('error', `Error while setting up twitch webhooks: ${e}`);
    });
  }

  startTunnel(resolve, reject) {
    ngrok.connect(8492, (e, url) => {
      if (e) {
        logger.log('info', `failed to connect to ngrok: ${e}`);
        reject(e);
      } else {
        logger.log('info', `ngrok connected at url ${url}`);
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
    // log.log('info', topic);
    // topic options, for example "{user_id: 12826}"
    // log.log('info', options);
    // full topic URL, for example
    // "https://api.twitch.tv/helix/streams?user_id=12826"
    // log.log('info', endpoint);
    // topic data, timestamps are automatically converted to Date
    // log.log('info', event);
    // });

    // set listener for topic
    twitchWebhook.on('streams', ({
      topic, options, endpoint, event,
    }) => {
      logger.log('info', topic);
      logger.log('info', options);
      logger.log('info', endpoint);
      logger.log('info', event);
      try {
        const [streamer] = this.streamers.filter(st => st.id === options.user_id);
        if (event.data && event.data.length) {
          this.bot.sendSubMessage(streamer);
        } else {
          logger.log('info', 'stream down: ' + options.user_id);
        }
      } catch (e) {
        console.log(`Failed while listening to sub events: ${e}`)
      }
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
      logger.warn(`Got unsubbed from a stream, resubbing ${obj}`);
    });

    logger.log('info', 'Subscribed to streams');
  }

  // tell TwitchWebhookHandler that we no longer listen otherwise it will try to send events to a down app
  // this will be called from mari-bot default on exit handling method
  unsubFromAll() {
    if (twitchWebhook) {
      twitchWebhook.unsubscribe('*');
    }
    logger.log('info', 'Unsubbed from all twitch hooks');
    ngrok.disconnect();
    ngrok.kill();
    logger.log('info', 'killed ngrok');
  }
};

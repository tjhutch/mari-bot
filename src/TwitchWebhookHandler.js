import TwitchWebhook from 'twitch-webhook';
import LoggerFactory from 'Logger';
import Tokens from 'config/Tokens';
import Streamers from 'config/TwitchStreamers';

const logger = LoggerFactory.getLogger();
let twitchWebhook;

export default class TwitchWebhookHandler {
  constructor(bot) {
    this.bot = bot;
    try {
      this.subscribeToStreams();
    } catch (e) {
      logger.log('error', `Error while setting up twitch webhooks: ${e}`);
    }
  }

  subscribeToStreams() {
    twitchWebhook = new TwitchWebhook({
      client_id: Tokens.twitchClientId,
      callback: Tokens.twitchCallbackUrl,
      secret: Tokens.twitchToken,
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
    Streamers.every((streamer) => {
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
  }
};

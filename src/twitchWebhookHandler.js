const TwitchWebhook = require('twitch-webhook');
const fs = require('fs');
const localTunnel = require('localtunnel');
let log;
let streamUpTimes = {};

module.exports = class TwitchWebhookHandler {

  constructor(logger, tokenData, configManager, subCallback) {
    log = logger;
    this.secret = tokenData.twitchToken;
    this.clientId = tokenData.twitchClientId;
    this.callbackUrl = getCallbackUrl();
    this.subCallback = subCallback;

    configManager.readStreamers().then((streamers) => {
      this.streamers = streamers;
      //  return new Promise(this.startTunnel);
      //}).then((tunnel) => {
      //  log.info("Tunnel created");
      //  this.tunnel = tunnel;
      this.subscribeToStreams();
    }).catch((e) => {
      log.error('Error while setting up twitch webhooks: ' + e);
    });
  }

  startTunnel(resolve, reject) {
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
  }

  subscribeToStreams() {
    const twitchWebhook = new TwitchWebhook({
      client_id: this.clientId,
      callback: this.callbackUrl,
      secret: this.secret,
      listen: {
        port: '8492',
        host: '127.0.0.1',    // default: 0.0.0.0
        autoStart: true      // default: true
      }
    });

// set listener for all topics
    twitchWebhook.on('*', ({ topic, options, endpoint, event }) => {
      // topic name, for example "streams"
      //log.info(topic);
      // topic options, for example "{user_id: 12826}"
      //log.info(options);
      // full topic URL, for example
      // "https://api.twitch.tv/helix/streams?user_id=12826"
      //log.info(endpoint);
      // topic data, timestamps are automatically converted to Date
      //log.info(event);
    });

    // set listener for topic
    twitchWebhook.on('streams', ({ topic, options, endpoint, event }) => {
      log.info(event);
      if (!event.data.length) {
        log.info("Skipping notification for stream down");
        return;
      }
      const [ data ] = event.data;
      let [ streamer ] = this.streamers.filter((streamer) => {
        return streamer.id === data.user_id;
      });
      if (!streamUpTimes[streamer.id] || streamUpTimes[streamer.id] !== data.started_at) {
        this.subCallback(streamer);
        streamUpTimes[streamer.id] = data.started_at;
      } else {
        log.info('stream for user ' + streamer.name + ' is already up, not sending notification');
      }
    });

    // subscribe to topic
    for (let streamer of this.streamers) {
      twitchWebhook.subscribe('streams', {
        user_id: streamer.id
      });
    }

    // renew the subscription when it expires
    twitchWebhook.on('unsubscribe', (obj) => {
      twitchWebhook.subscribe(obj['hub.topic']);
      log.warn('Got unsubbed from a stream, resubbing ' + obj);
    });

    // tell TwitchWebhookHandler that we no longer listen
    // otherwise it will try to send events to a down app
    process.on('SIGINT', () => {
      // unsubscribe from all topics
      twitchWebhook.unsubscribe('*');
      log.info('Unsubbed from all twitch hooks');
      process.exit(0);
    });
    log.info("Subscribed to streams");
  }
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
// server to request/receive stream up/down notifications
// documentation: https://dev.twitch.tv/docs/api/webhooks-reference#topic-stream-updown
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 6037;
const https = require('https');
let secret = '', log, streamIds;

let subSecret = '';

app.use(bodyParser.json());

app.post('/', function (req, res) {
  // let twitch know we received the message
  res.send(200);
  let [data] = req.body.data;
  if (data.type === 'live') {
    //TODO: Trigger live messages
  }
});

var server = app.listen(port, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Twitch Hooks listening at http://%s:%s', host, port);

});

module.exports = function twitchHooks(logger) {
  log = logger;
  this.getStreamers = function() {
    fs.readFile('../twitchStreamers.json', null, (err, json) => {
      if (err) {
        log.error('failed to read token');
        process.exit(1);
      } else {
        streamIds = JSON.parse(json);
        log.info("Read twitch streamers");
        this.subscribeToStreams();
      }
    });
  };

  this.subscribeToStreams = function() {
    for (let id of streamIds) {
      let subOptions = {
        path: 'https://api.twitch.tv/helix/webhooks/hub?' +
        'hub.mode=subscribe&' +
        'hub.topic=https://api.twitch.tv/helix/streams?to_id=' + id + '&' +
        'hub.callback=TODO&' +
        'hub.lease_seconds=864000&' +
        'hub.secret=' + secret,
        auth: 'Bearer ' + secret,
      };
      https.get(subOptions, (res) => {
        if (res.status === 200 && res.query['hub.mode'] === 'subscribe') {
          subSecret = res.query['hub.challenge'];
        } else {
          log.error('failed to subscribe to twitch notifications!');
        }
      })
    }
  };

  fs.readFile('../token.json', null, (err, json) => {
    if (err) {
      log.error('failed to read twitch token');
    } else {
      let data = JSON.parse(json);
      log.info("Read twitch token");
      secret = data.twitchToken;
      this.getStreamers();
    }
  });
};
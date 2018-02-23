// server to request/receive stream up/down notifications
// documentation: https://dev.twitch.tv/docs/api/webhooks-reference#topic-stream-updown

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 9999;
let subSecret = '';
const Logging = require('./Logging.js');

const log = new Logging(process.argv.length > 2);

app.use(bodyParser.json());

app.get('/', function (req) {
  const body = req.body;
  if (req.status === 200) {
    log.info('subscription failed');
  } else {
    subSecret = body; //TODO: check how this is returned
  }

});

app.post('/', function (req, res) {
  // let twitch know we received the message
  res.send(200);

  //TODO: extract data to see which stream went live, then send messages via discord
});

var server = app.listen(port, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

});
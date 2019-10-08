# mari-bot
This is a bot for our den mother, Mari. 

This project uses the discord.js implementation of the discord API. You can learn more and find documentation [on their website](https://discord.js.org).
For the twitch webhooks API, this project uses the [twitch-webhook package](https://www.npmjs.com/package/twitch-webhook).

## Features
* Playback audio clips
* Respond with pre-configured messages
* Add text commands on demand
* Audio on multiple servers at once
* Welcome new users to the server
* User level-up system based on # of messages sent in the server
* Meme collection and re-use
* NEW PHONE WHO DIS

## WIP Features
* Send updates when configured streamers go live
* Role management via commands & reactions
* Send updates when configured users post on twitter

## Setup
1. Install node 12
2. Clone the repo
3. Install  libtool and autoconf
    * for linux, `sudo apt-get install libtool` `sudo apt-get install autoconf`
    * for osx, `brew install libtool` `brew install autoconf`
    * for windows not sure, haven't tried yet
4. Run `npm i` in the root of the repo
5. Request src/config/Tokens.json file from [me](t.jhutch44@gmail.com) or add your own bot tokens
6. Run the bot with `node -r esm src/mari-bot`
    * add `-l` or `--log-to-console` for console logging
    * logs will always be saved to `error.log` and `debug.log`
    * add `-t` or `--twitch-notifications` for twitch streamer notifications (WIP)

# mari-bot
This is a bot for our den mother, Mari. 

This project uses the discord.js implementation of the discord API. You can learn more and find documentation [on their website](https://discord.js.org).
For the twitch webhooks API, this project uses the [twitch-webhook package](https://www.npmjs.com/package/twitch-webhook).

## Features
* Playback audio clips
* Respond with pre-configured messages
* Audio on multiple servers at once
* Welcome new users to the server
* User level-up system based on # of messages sent in the server
* Meme collection and re-use
* Hot reload configuration
* Send updates when configured streamers go live

## Setup
1. Install node >= 8 (tested using 8.9.1)
2. Clone the repo
3. Run 'npm i' in the root of the repo
4. Install FFMPEG [here](https://www.ffmpeg.org/) and add it to your PATH
5. Run start.sh

#!/usr/bin/env bash
cp bin/ngrok.exe node_modules/ngrok/bin/ngrok.exe
cd src/
node mari-bot.js --log-to-console
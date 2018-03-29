#!/usr/bin/env bash
if [ ! -f node_modules/ngrok/bin/ngrok.exe ];
then
    cp bin/ngrok.exe node_modules/ngrok/bin/ngrok.exe
    echo "Copied ngrok executable"
fi
node src/mari-bot.js -l
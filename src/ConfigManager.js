import fs from 'fs';

const GUILD_LEVELS = './src/config/guildLevels.js';
const MEMES = './src/config/memes.js';
const COMMANDS = './src/config/CommandConfig.js';

function saveMemes(memes) {
  fs.writeFileSync(MEMES, `export default ${JSON.stringify(memes, null, 2)}`, 'utf-8');
}

function saveCommands(commands) {
  fs.writeFileSync(COMMANDS, `export default ${JSON.stringify(commands, null, 2)}`, 'utf-8');
}

function saveGuildLevels(guildLevels) {
  fs.writeFileSync(GUILD_LEVELS, `export default ${JSON.stringify(guildLevels, null, 2)}`, 'utf-8');
}

export default {
  saveMemes,
  saveCommands,
  saveGuildLevels
};

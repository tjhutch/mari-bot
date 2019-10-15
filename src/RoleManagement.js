import LoggerFactory from './Logger';

const logger = LoggerFactory.getLogger();

async function managePermissions(reaction, user, guildSettings, add) {
  const { message } = reaction;
  const { channel } = message;
  if (!channel.guild.available) {
    logger.log('error', `Got reaction, but guild ${channel.guild.name} is not available!`);
    return;
  }
  if (guildSettings.managedRoles && message.id === guildSettings.roleMessageID) {
    try {
      const role = this.matchRoleToReaction(reaction, user, channel.guild, guildSettings);
      const guildUser = await channel.guild.fetchMember(user);
      const newUser = await (add ? guildUser.addRole(role) : guildUser.removeRole(role));
      logger.log('info', `${add ? 'added' : 'removed'} the role ${role.name} for ${newUser.displayName}`);
    } catch (e) {
      logger.log('error', `Failed to give role to user: ${e}`);
    }
  }
}

function matchRoleToReaction(reaction, user, guild, guildSettings) {
  for(let i = 0; i < guildSettings.roleReactions.length; i++) {
    let roleReaction = guildSettings.roleReactions[i];
    if (roleReaction === reaction.emoji.name) {
      try {
        const roleName = guildSettings.managedRoles[i];
        return this.getRoleByName(guild, roleName);
      } catch (e) {
        logger.log('error', `Failed to get role for user: ${e}`)
      }
    }
  }
}

function getRoleByName(guild, roleName) {
  return guild.roles.filter(role => role.name === roleName).first();
}

function manageRolesByMsg(msg, add) {
  const users = msg.mentions.members;
  const role = this.getRoleByName(msg.split(' ')[1]);
  try {
    users.map(async user => {
      const newUser = await (add ? user.addRole(role) : user.removeRole(role));
      logger.log('info', `${add ? 'added' : 'removed'} role ${role.name} ${add ? 'to' : 'from'} ${newUser.username}`);
    });
  } catch (e) {
    logger.log('error', `Failed to ${add ? 'add' : 'remove'} role ${add ? 'to' : 'from'} users in "${msg.content}": ${e}`);
  }
}

export default {
  managePermissions,
  matchRoleToReaction,
  getRoleByName,
  manageRolesByMsg,
}

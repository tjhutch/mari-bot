const { Service } = require('node-windows');

// Create a new service object
const svc = new Service({
  name: 'Mari Bot',
  script: require('C:/workspace/mari-bot/src').join(__dirname, 'mari-bot.js'),
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', () => {
  console.log('Uninstall complete.');
  console.log('The service exists: ', svc.exists);
});

// Uninstall the service.
svc.uninstall();

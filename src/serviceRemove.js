var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name: 'Mari Bot',
  script: require('C:/workspace/mari-bot/src').join(__dirname, 'mari-bot.js')
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', function () {
  console.log('Uninstall complete.');
  console.log('The service exists: ', svc.exists);
});

// Uninstall the service.
svc.uninstall();
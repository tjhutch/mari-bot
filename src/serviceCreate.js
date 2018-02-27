var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name: 'Mari Bot',
  description: 'Mari bot discord bot',
  script: 'C:\\workspace\\mari-bot\\src\\mari-bot.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function () {
  svc.start();
});

svc.install();
const EventLogger = require('node-windows').EventLogger;
const log = new EventLogger('Mari Bot');

module.exports = function Logging (logToConsole) {
  this.logToConsole = logToConsole;

  this.info = function info(s) {
    if (this.logToConsole) {
      console.log(s);
    }
    else {
      log.info(s);
    }
  };

  this.warn = function warn(s) {
    if (this.logToConsole) {
      console.warn(s);
    } else {
      log.warn(s);
    }
  };

  this.error = function error(s) {
    log.error(s);
    if (this.logToConsole) {
      console.error(s);
    } else {
      log.warn(s);
    }
  };
};
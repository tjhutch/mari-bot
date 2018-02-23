const EventLogger = require('node-windows').EventLogger;
const log = new EventLogger('Mari Bot');

module.exports = function Logging (logToConsole) {
  this.logToConsole = logToConsole;

  this.info = function info(s) {
    log.info(s);
    if (this.logToConsole) {
      console.log(s);
    }
  };

  this.warn = function warn(s) {
    log.warn(s);
    if (this.logToConsole) {
      console.warn(s);
    }
  };

  this.error = function error(s) {
    log.error(s);
    if (this.logToConsole) {
      console.error(s);
    }
  };
};
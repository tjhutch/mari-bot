const EventLogger = require('node-windows').EventLogger;

const log = new EventLogger('Mari Bot');

class Logging {
  constructor(logToConsole) {
    this.logToConsole = logToConsole;
  }

  info(s) {
    if (this.logToConsole) {
      console.log(s);
    } else {
      log.info(s);
    }
  }

  warn(s) {
    if (this.logToConsole) {
      console.warn(s);
    } else {
      log.warn(s);
    }
  }

  error(s) {
    log.error(s);
    if (this.logToConsole) {
      console.error(s);
    } else {
      log.warn(s);
    }
  }
}

function checkConsoleLogging() {
  if (process.argv) {
    for (const value of process.argv) {
      if (/^(--log-to-console|-l)/.test(value)) {
        return true;
      }
    }
  }
  return false;
}

const logger = new Logging(checkConsoleLogging());
function getLogger() {
  return logger;
}

module.exports = {
  getLogger,
};

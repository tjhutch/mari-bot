const { format, createLogger, transports } = require('winston');

function consoleLogEnabled() {
  if (process.argv) {
    for (const value of process.argv) {
      if (/^(--log-to-console|-l)/.test(value)) {
        return true;
      }
    }
  }
  return false;
}
const loggerOpts = {
  level: 'info',
  format: format.combine(
    format.timestamp({
      format: 'MM-DD HH:mm:ss'
    }),
    format.simple()
  ),
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'debug.log', level: 'debug' }),
    new transports.File({ filename: 'combined.log' })
  ]
};
if (consoleLogEnabled()) {
  loggerOpts.transports.push(new transports.Console());
}

const logger = createLogger(loggerOpts);

function getLogger() {
  return logger;
}

module.exports = {
  getLogger,
};

import winston from 'winston';
import chalk from 'chalk';
import { format } from 'date-fns';

const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const ts = format(new Date(timestamp as string), 'yyyy-MM-dd HH:mm:ss');
  
  let coloredLevel: string;
  switch (level) {
    case 'error':
      coloredLevel = chalk.red.bold('ERROR');
      break;
    case 'warn':
      coloredLevel = chalk.yellow.bold('WARN ');
      break;
    case 'info':
      coloredLevel = chalk.blue.bold('INFO ');
      break;
    case 'debug':
      coloredLevel = chalk.gray('DEBUG');
      break;
    default:
      coloredLevel = level.toUpperCase();
  }

  const metaStr = Object.keys(meta).length ? ` ${chalk.gray(JSON.stringify(meta))}` : '';
  return `${chalk.gray(ts)} ${coloredLevel} ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        customFormat
      )
    }),
    new winston.transports.File({
      filename: 'data/bot.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({
      filename: 'data/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Trade-specific logging
export const tradeLog = {
  decision: (symbol: string, action: string, reason: string, confidence: number) => {
    logger.info(
      `${chalk.cyan('DECISION')} ${chalk.yellow(symbol)} ${chalk.green(action)} ` +
      `(${(confidence * 100).toFixed(0)}% confidence) - ${reason}`
    );
  },

  executed: (symbol: string, side: string, size: number, price: number) => {
    const sideColor = side === 'buy' ? chalk.green : chalk.red;
    logger.info(
      `${chalk.magenta('EXECUTED')} ${sideColor(side.toUpperCase())} ` +
      `${chalk.yellow(symbol)} size=${size} @ $${price.toFixed(2)}`
    );
  },

  pnl: (symbol: string, pnl: number, pnlPct: number) => {
    const color = pnl >= 0 ? chalk.green : chalk.red;
    const sign = pnl >= 0 ? '+' : '';
    logger.info(
      `${chalk.cyan('P&L')} ${chalk.yellow(symbol)} ` +
      `${color(`${sign}$${pnl.toFixed(2)} (${sign}${pnlPct.toFixed(2)}%)`)}`
    );
  },

  cycle: (cycleNum: number, portfolioValue: number, dailyPnl: number) => {
    const pnlColor = dailyPnl >= 0 ? chalk.green : chalk.red;
    const sign = dailyPnl >= 0 ? '+' : '';
    logger.info(
      `${chalk.bgBlue.white(` CYCLE ${cycleNum} `)} ` +
      `Portfolio: ${chalk.yellow(`$${portfolioValue.toFixed(2)}`)} | ` +
      `Daily P&L: ${pnlColor(`${sign}${dailyPnl.toFixed(2)}%`)}`
    );
  },

  error: (context: string, error: Error | string) => {
    const errorMsg = error instanceof Error ? error.message : error;
    logger.error(`${chalk.bgRed.white(' ERROR ')} [${context}] ${errorMsg}`);
  },

  warning: (message: string) => {
    logger.warn(`${chalk.bgYellow.black(' WARN ')} ${message}`);
  },

  ai: (action: string, details: string) => {
    logger.info(`${chalk.bgMagenta.white(' AI ')} ${action}: ${details}`);
  }
};

export default logger;

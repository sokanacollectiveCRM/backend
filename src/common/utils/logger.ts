import pino from 'pino';
import pinoHttp from 'pino-http';

const isProd = process.env.NODE_ENV === 'production';

const redactPaths = [
  'email',
  'password',
  'address',
  'ssn',
  'phone',
  'health_history',
  'dob',
  '*.email',
];

const baseOptions: pino.LoggerOptions = {
  redact: {
    paths: redactPaths,
    censor: '[PHI_REDACTED]',
  },
  formatters: {
    level(label) {
      return { severity: label.toUpperCase() };
    },
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: false,
        },
      },
};

export const logger = pino(baseOptions);

export const httpLogger = pinoHttp({
  logger,
  redact: {
    paths: redactPaths,
    censor: '[PHI_REDACTED]',
  },
});

export default logger;

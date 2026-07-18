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
  'token',
  'intuit_token',
  'cardToken',
  'card.number',
  'card.cvc',
  'card.expMonth',
  'card.expYear',
  '*.email',
  'session_token',
  '*.session_token',
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
  hooks: {
    logMethod(args, method) {
      const allowed = new Set([
        'service', 'module', 'operation', 'correlationId', 'method', 'route',
        'status', 'durationMs', 'errorCode', 'retryable', 'severity', 'context',
        'count', 'source', 'partsCount', 'port', 'host',
      ]);
      const first = args[0];
      if (first && typeof first === 'object') {
        const safe = Object.fromEntries(
          Object.entries(first as Record<string, unknown>).filter(([key, value]) =>
            allowed.has(key) && ['string', 'number', 'boolean'].includes(typeof value)
          )
        );
        method.apply(this, [safe, ...args.slice(1)]);
        return;
      }
      // A bare Error or dynamic object has no approved diagnostic fields.
      method.apply(this, args);
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

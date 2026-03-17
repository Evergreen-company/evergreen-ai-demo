'use strict';

const pino = require('pino');
const { trace } = require('@opentelemetry/api');

const isDev = process.env.NODE_ENV !== 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: process.env.OTEL_SERVICE_NAME || 'api',
    env: process.env.APP_ENV || 'demo',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

const logger = new Proxy(baseLogger, {
  get(target, prop) {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    if (!levels.includes(prop)) return target[prop];

    return function (...args) {
      const span = trace.getActiveSpan();
      if (!span) return target[prop](...args);

      const ctx = span.spanContext();
      if (typeof args[0] === 'object' && args[0] !== null) {
        args[0] = { ...args[0], traceId: ctx.traceId, spanId: ctx.spanId };
      } else if (typeof args[0] === 'string') {
        args.unshift({ traceId: ctx.traceId, spanId: ctx.spanId });
      }
      return target[prop](...args);
    };
  },
});

module.exports = logger;

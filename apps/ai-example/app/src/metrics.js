'use strict';

const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  labels: {
    service: process.env.OTEL_SERVICE_NAME || 'api',
    env: process.env.APP_ENV || 'demo',
  },
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of Redis cache hits',
  labelNames: ['key_prefix'],
  registers: [register],
});

const cacheMissesTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of Redis cache misses',
  labelNames: ['key_prefix'],
  registers: [register],
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of currently active HTTP connections',
  registers: [register],
});

module.exports = {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  cacheHitsTotal,
  cacheMissesTotal,
  activeConnections,
};

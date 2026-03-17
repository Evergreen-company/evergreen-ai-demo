'use strict';

const express = require('express');
const { register, httpRequestDuration, httpRequestsTotal, activeConnections } = require('./metrics');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


app.use((req, res, next) => {
  activeConnections.inc();
  res.on('finish', () => activeConnections.dec());
  next();
});

app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  const end = httpRequestDuration.startTimer();
  const startTime = Date.now();

  res.on('finish', () => {
    const route = (req.route && req.route.path)
      ? `${req.baseUrl || ''}${req.route.path}`
      : req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };

    end(labels);
    httpRequestsTotal.inc(labels);

    const duration = Date.now() - startTime;
    logger.info({ method: req.method, path: req.path, route, status: res.statusCode, duration }, 'request completed');
  });

  next();
});

const healthRouter = require('./routes/health');
const usersRouter = require('./routes/users');

app.get('/health', healthRouter.healthHandler);
app.get('/ready', healthRouter.readyHandler);
app.use('/api/users', usersRouter);
app.use('/api/products', require('./routes/products'));
app.use('/api/simulate', require('./routes/simulation'));

const Redis = require('ioredis');
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redisClient.on('connect', () => logger.info('redis connected'));
redisClient.on('error', (err) => logger.error({ err }, 'redis error'));

healthRouter.setRedisClient(redisClient);
usersRouter.setRedisClient(redisClient);

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});


app.use((req, res) => {
  logger.warn({ path: req.path }, 'route not found');
  res.status(404).json({ error: 'not found', path: req.path });
});

app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, 'unhandled error');
  res.status(500).json({ error: 'internal server error' });
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'server started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});

module.exports = app;

'use strict';

const express = require('express');
const logger = require('../logger');

let redisClient = null;

function setRedisClient(client) {
  redisClient = client;
}

function healthHandler(req, res) {
  res.json({
    status: 'ok',
    service: process.env.OTEL_SERVICE_NAME || 'api',
    env: process.env.APP_ENV || 'demo',
    timestamp: new Date().toISOString(),
  });
}

async function readyHandler(req, res) {
  const checks = { redis: 'unknown' };

  try {
    if (redisClient) {
      await redisClient.ping();
      checks.redis = 'ok';
    } else {
      checks.redis = 'not configured';
    }
  } catch (err) {
    logger.warn({ err }, 'readiness check: redis ping failed');
    checks.redis = 'error';
  }

  const healthy = Object.values(checks).every((v) => v === 'ok' || v === 'not configured');
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'not ready', checks });
}

const router = express.Router();
router.get('/', healthHandler);

module.exports = router;
module.exports.healthHandler = healthHandler;
module.exports.readyHandler = readyHandler;
module.exports.setRedisClient = setRedisClient;

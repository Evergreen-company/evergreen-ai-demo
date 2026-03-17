'use strict';

const express = require('express');
const router = express.Router();
const logger = require('../logger');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fibonacci(n) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return a;
}

router.get('/slow', async (req, res) => {
  const min = parseInt(req.query.min || '500', 10);
  const max = parseInt(req.query.max || '3000', 10);
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;

  logger.info({ delay }, 'slow route: sleeping');
  await sleep(delay);

  res.json({ message: 'slow response', delay_ms: delay });
});

router.get('/cpu', (req, res) => {
  const n = parseInt(req.query.n || '40', 10);
  const clamped = Math.min(n, 45);

  const start = Date.now();
  const result = fibonacci(clamped);
  const duration = Date.now() - start;

  logger.info({ n: clamped, duration_ms: duration }, 'cpu route: fibonacci computed');
  res.json({ message: 'cpu work done', n: clamped, result, duration_ms: duration });
});

router.get('/error', (req, res) => {
  const failRate = parseFloat(req.query.rate || '0.3');

  if (Math.random() < failRate) {
    logger.error({ failRate }, 'simulated error triggered');
    return res.status(500).json({ error: 'simulated internal error', failRate });
  }

  logger.info({ failRate }, 'error route: no error this time');
  res.json({ message: 'ok, no error this time', failRate });
});

router.get('/broken', (req, res) => {
  const reason = req.query.reason || 'intentional failure';
  logger.error(
    { endpoint: '/api/simulate/broken', reason, requestId: req.headers['x-request-id'] || null },
    'broken endpoint called — this error is intentional',
  );
  res.status(500).json({
    error: 'broken_endpoint',
    message: 'This endpoint always fails. Check Loki for the error log and Tempo for the trace.',
    reason,
  });
});

router.get('/memory', (req, res) => {
  const mb = Math.min(parseInt(req.query.mb || '10', 10), 100);
  const buf = Buffer.alloc(mb * 1024 * 1024, 'x');

  logger.info({ mb }, 'memory route: buffer allocated');

  setImmediate(() => buf.fill(0));

  res.json({ message: 'memory spike done', allocated_mb: mb });
});

module.exports = router;

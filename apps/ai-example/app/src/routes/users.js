'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const { cacheHitsTotal, cacheMissesTotal } = require('../metrics');

const db = require('../data/db.json');
const users = [...db.users];

let redisClient = null;

function setRedisClient(client) {
  redisClient = client;
}

const CACHE_TTL = 30;
const CACHE_PREFIX = 'users';

async function getFromCache(key) {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn({ err, key }, 'cache get failed');
    return null;
  }
}

async function setInCache(key, value) {
  if (!redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', CACHE_TTL);
  } catch (err) {
    logger.warn({ err, key }, 'cache set failed');
  }
}

async function invalidateCache(pattern) {
  if (!redisClient) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) await redisClient.del(...keys);
  } catch (err) {
    logger.warn({ err, pattern }, 'cache invalidation failed');
  }
}

router.get('/', async (req, res) => {
  const cacheKey = `${CACHE_PREFIX}:all`;
  const cached = await getFromCache(cacheKey);

  if (cached) {
    cacheHitsTotal.inc({ key_prefix: CACHE_PREFIX });
    logger.debug({ count: cached.length }, 'users served from cache');
    return res.json({ data: cached, source: 'cache' });
  }

  cacheMissesTotal.inc({ key_prefix: CACHE_PREFIX });
  await setInCache(cacheKey, users);
  logger.info({ count: users.length }, 'users fetched from db');
  res.json({ data: users, source: 'db' });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `${CACHE_PREFIX}:${id}`;

  const cached = await getFromCache(cacheKey);
  if (cached) {
    cacheHitsTotal.inc({ key_prefix: CACHE_PREFIX });
    return res.json({ data: cached, source: 'cache' });
  }

  cacheMissesTotal.inc({ key_prefix: CACHE_PREFIX });
  const user = users.find((u) => u.id === id);
  if (!user) {
    logger.warn({ id }, 'user not found');
    return res.status(404).json({ error: 'user not found', id });
  }

  await setInCache(cacheKey, user);
  logger.info({ id }, 'user fetched from db');
  res.json({ data: user, source: 'db' });
});

router.post('/', async (req, res) => {
  const { name, email, role } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const user = {
    id: uuidv4(),
    name,
    email,
    role: role || 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await invalidateCache(`${CACHE_PREFIX}:*`);
  logger.info({ userId: user.id, email }, 'user created');
  res.status(201).json({ data: user });
});

module.exports = router;
module.exports.setRedisClient = setRedisClient;

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

const db = require('../data/db.json');
const products = [...db.products];

router.get('/', (req, res) => {
  const { category, limit = 50 } = req.query;

  let result = products;
  if (category) {
    result = products.filter((p) => p.category === category);
  }

  result = result.slice(0, parseInt(limit, 10));
  logger.info({ count: result.length, category: category || 'all' }, 'products listed');
  res.json({ data: result, total: result.length });
});

router.get('/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) {
    logger.warn({ id: req.params.id }, 'product not found');
    return res.status(404).json({ error: 'product not found', id: req.params.id });
  }
  res.json({ data: product });
});

router.post('/', (req, res) => {
  const { name, price, category, stock } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name and price are required' });
  }

  const product = {
    id: uuidv4(),
    name,
    price: parseFloat(price),
    category: category || 'uncategorized',
    stock: stock !== undefined ? parseInt(stock, 10) : 0,
    createdAt: new Date().toISOString(),
  };

  products.push(product);
  logger.info({ productId: product.id, name, category: product.category }, 'product created');
  res.status(201).json({ data: product });
});

module.exports = router;

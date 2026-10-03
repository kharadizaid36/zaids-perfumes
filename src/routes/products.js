const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/products - list all products with optional category & search filter
router.get('/', (req, res) => {
  try {
    const { category, search, sort } = req.query;
    let products = db.getProducts(category, search);

    if (sort === 'price-low') {
      products.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      products.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
      products.sort((a, b) => b.rating - a.rating);
    }

    res.json({ success: true, count: products.length, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/:id - single product by ID or slug
router.get('/:id', (req, res) => {
  try {
    const product = db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const reviews = db.getReviews(product.id);
    res.json({ success: true, product, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products/:id/reviews - submit a customer review
router.post('/:id/reviews', (req, res) => {
  try {
    const { userName, rating, comment } = req.body;
    if (!userName || !comment) {
      return res.status(400).json({ success: false, message: 'Name and comment are required' });
    }

    const review = db.addReview({
      productId: req.params.id,
      userName,
      rating: Number(rating) || 5,
      comment
    });

    res.json({ success: true, message: 'Review submitted successfully', review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN: POST /api/products - Add new perfume (Protected)
router.post('/', requireAdmin, (req, res) => {
  try {
    const { title, price, category } = req.body;
    if (!title || !price || !category) {
      return res.status(400).json({ success: false, message: 'Title, price and category are required' });
    }

    const newProd = db.addProduct(req.body);
    res.status(201).json({ success: true, message: 'Product added successfully', product: newProd });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN: PUT /api/products/:id - Update perfume (Protected)
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const updated = db.updateProduct(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product updated successfully', product: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN: DELETE /api/products/:id - Delete perfume (Protected)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const deleted = db.deleteProduct(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Product not found or already deleted' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

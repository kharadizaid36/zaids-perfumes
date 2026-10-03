const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// POST /api/coupons/validate - Check coupon validity during checkout
router.post('/validate', (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Please enter a coupon code' });
    }

    const coupon = db.getCouponByCode(code);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code' });
    }

    const total = Number(cartTotal) || 0;
    if (coupon.minOrder && total < coupon.minOrder) {
      return res.status(400).json({
        success: false,
        message: `This code requires a minimum cart value of ₹${coupon.minOrder}`
      });
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Math.round((total * coupon.discountValue) / 100);
    } else {
      discount = Math.min(total, coupon.discountValue);
    }

    res.json({
      success: true,
      message: `Coupon "${coupon.code}" applied! You saved ₹${discount}`,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/coupons - List all coupons (Admin, Protected)
router.get('/', requireAdmin, (req, res) => {
  try {
    const coupons = db.getCoupons();
    res.json({ success: true, count: coupons.length, coupons });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/coupons - Create coupon (Admin, Protected)
router.post('/', requireAdmin, (req, res) => {
  try {
    const { code, discountValue, discountType, minOrder, description } = req.body;
    if (!code || !discountValue) {
      return res.status(400).json({ success: false, message: 'Code and discount value are required' });
    }

    const coupon = db.addCoupon({ code, discountValue, discountType, minOrder, description });
    res.status(201).json({ success: true, message: 'Coupon created successfully', coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/coupons/:id - Remove coupon (Admin, Protected)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    db.deleteCoupon(req.params.id);
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/admin/stats - Overview metrics for dashboard (Protected)
router.get('/stats', requireAdmin, (req, res) => {
  try {
    const orders = db.getOrders();
    const products = db.getProducts();

    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled').length;
    const deliveredOrders = orders.filter(o => o.orderStatus === 'Delivered').length;
    
    // Low stock items (stock <= 30)
    const lowStockItems = products.filter(p => p.stock <= 30);

    // Recent 5 orders
    const recentOrders = orders.slice(0, 5);

    res.json({
      success: true,
      stats: {
        totalRevenue,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        totalProducts: products.length,
        lowStockCount: lowStockItems.length,
        conversionRate: '4.2%'
      },
      lowStockItems,
      recentOrders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/settings - Read store configuration (Public safe settings for banner/shipping)
router.get('/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/settings - Update store configuration (Protected)
router.put('/settings', requireAdmin, (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    res.json({ success: true, message: 'Store settings updated successfully', settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

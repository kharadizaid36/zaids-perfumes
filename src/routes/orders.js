const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { orderRateLimiter, sanitizeInput } = require('../middleware/security');

// POST /api/orders - Place a new order from checkout
router.post('/', orderRateLimiter, (req, res) => {
  try {
    const cleanBody = sanitizeInput(req.body);
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      city,
      state,
      pincode,
      paymentMethod,
      utrNumber,
      paymentProofBase64,
      items,
      subtotal,
      discount,
      couponUsed,
      total,
      userId
    } = cleanBody;

    if (!customerName || !customerPhone || !shippingAddress || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone number, complete delivery address, and items are required'
      });
    }

    const cleanPaymentMethod = (paymentMethod || 'COD').toUpperCase();
    let cleanUtr = utrNumber ? String(utrNumber).trim() : null;
    let paymentProofUrl = null;

    // Strict validation for UPI payment security
    if (cleanPaymentMethod === 'UPI') {
      if (!cleanUtr || !/^\d{12}$/.test(cleanUtr)) {
        return res.status(400).json({
          success: false,
          message: 'Security Verification Error: Please provide a valid 12-digit numeric UPI Reference / UTR Number from your PhonePe, Google Pay, or Paytm receipt.'
        });
      }

      // Anti-Fraud / Anti-Replay: Check if UTR was already used
      const existingOrderWithUtr = db.checkDuplicateUtr(cleanUtr);
      if (existingOrderWithUtr) {
        return res.status(400).json({
          success: false,
          message: `Fraud Prevention Alert: This 12-digit UPI Reference / UTR Number (${cleanUtr}) has already been submitted for Order #${existingOrderWithUtr.id}. Duplicate transaction IDs are strictly rejected.`
        });
      }

      // Save screenshot proof if uploaded
      if (paymentProofBase64 && typeof paymentProofBase64 === 'string') {
        const matches = paymentProofBase64.match(/^data:image\/([a-zA-Z0-9.+]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const ext = matches[1].replace('jpeg', 'jpg');
          const buffer = Buffer.from(matches[2], 'base64');
          // Limit buffer size to 5MB
          if (buffer.length <= 5 * 1024 * 1024) {
            const fileName = `utr_${cleanUtr}_${Date.now()}.${ext}`;
            const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'payments');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            fs.writeFileSync(path.join(uploadDir, fileName), buffer);
            paymentProofUrl = `/uploads/payments/${fileName}`;
          }
        }
      }
    }

    const order = db.createOrder({
      customerName,
      customerEmail: customerEmail || 'guest@zaidsperfumes.com',
      customerPhone,
      shippingAddress,
      city: city || 'Mumbai',
      state: state || 'Maharashtra',
      pincode: pincode || '400001',
      paymentMethod: cleanPaymentMethod,
      utrNumber: cleanUtr,
      paymentProofUrl,
      items,
      subtotal: Number(subtotal) || Number(total) || 399,
      discount: Number(discount) || 0,
      couponUsed: couponUsed || null,
      shippingFee: 0,
      total: Number(total) || 399,
      userId: userId || null
    });

    const isUpi = cleanPaymentMethod === 'UPI';
    const message = isUpi
      ? `Order #${order.id} received! Your 12-digit UTR (${cleanUtr}) has been queued for verification with Zaid's PhonePe merchant account.`
      : 'Order placed successfully! Thank you for choosing ZAID\'S PERFUMES.';

    res.status(201).json({
      success: true,
      message,
      orderId: order.id,
      order
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/track/:id - Public tracking endpoint for customer tracker
router.get('/track/:id', (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found with the provided ID' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/my-orders - Get orders by customer email or phone
router.get('/my-orders', (req, res) => {
  try {
    const query = req.query.email || req.query.phone || req.query.userId;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Customer email or phone required to look up orders' });
    }
    const orders = db.getOrdersByEmailOrPhone(query);
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN: GET /api/orders - List all orders with verification metadata (Protected)
router.get('/', requireAdmin, (req, res) => {
  try {
    const { status, verification } = req.query;
    let orders = db.getOrders();

    const pendingVerificationCount = orders.filter(
      o => o.paymentMethod === 'UPI' && o.paymentStatus === 'Verification Pending'
    ).length;

    if (verification === 'pending') {
      orders = orders.filter(
        o => o.paymentMethod === 'UPI' && o.paymentStatus === 'Verification Pending'
      );
    } else if (status && status !== 'all') {
      orders = orders.filter(o => o.orderStatus.toLowerCase() === status.toLowerCase());
    }

    res.json({
      success: true,
      count: orders.length,
      pendingVerificationCount,
      orders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN: PUT /api/orders/:id/verify-payment - Verify or reject UPI payment (Protected)
router.put('/:id/verify-payment', requireAdmin, (req, res) => {
  try {
    const { action, reason } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject"'
      });
    }

    const adminUser = (req.user && (req.user.name || req.user.email)) || 'Zaid (Merchant)';
    const updated = db.verifyOrderPayment(req.params.id, action, adminUser, reason);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Order not found with provided ID' });
    }

    const successMessage = action === 'approve'
      ? `Payment verified for Order #${updated.id}! Marked as Paid and moved to Processing.`
      : `Payment rejected for Order #${updated.id}. Stock inventory has been restored.`;

    res.json({
      success: true,
      message: successMessage,
      order: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN: PUT /api/orders/:id/status - Update order status & courier details (Protected)
router.put('/:id/status', requireAdmin, (req, res) => {
  try {
    const { orderStatus, courierName, trackingNumber } = req.body;
    if (!orderStatus) {
      return res.status(400).json({ success: false, message: 'New order status is required' });
    }

    const updated = db.updateOrderStatus(req.params.id, orderStatus, courierName, trackingNumber);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      message: `Order #${updated.id} status updated to ${orderStatus}`,
      order: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

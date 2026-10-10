const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { contactRateLimiter, sanitizeInput } = require('../middleware/security');

/**
 * POST /api/contact - Customer Contact & Grievance Submission
 * Rate-limited and sanitized to protect against spam and XSS
 */
router.post('/', contactRateLimiter, (req, res) => {
  try {
    const cleanBody = sanitizeInput(req.body);
    const { name, email, phone, subject, orderId, message } = cleanBody;

    if (!name || !message || (!email && !phone)) {
      return res.status(400).json({
        success: false,
        message: 'Name, message, and at least one contact method (email or phone) are required.'
      });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 100 characters.'
      });
    }

    if (message.length < 5 || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message must be between 5 and 2000 characters.'
      });
    }

    const inquiry = db.addInquiry({
      name,
      email: email || null,
      phone: phone || null,
      subject: subject || 'General Inquiry',
      orderId: orderId || null,
      message,
      ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown'
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received by Zaid\'s Perfumes support. We will get back to you within 24-48 business hours.',
      inquiryId: inquiry.id
    });
  } catch (err) {
    console.error('Contact submission error:', err);
    res.status(500).json({ success: false, message: 'Server error processing inquiry.' });
  }
});

/**
 * GET /api/contact/admin-inquiries - List customer inquiries for Admin
 */
router.get('/admin-inquiries', requireAdmin, (req, res) => {
  try {
    const inquiries = db.getInquiries();
    res.json({
      success: true,
      count: inquiries.length,
      inquiries
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/contact/admin-inquiries/:id/status - Update inquiry status
 */
router.put('/admin-inquiries/:id/status', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const dbData = require('../db');
    // Read raw db or update
    const dbObj = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'db.json'), 'utf8');
    const parsed = JSON.parse(dbObj);
    const inq = (parsed.inquiries || []).find(i => i.id === id);
    if (!inq) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }
    inq.status = status || 'responded';
    require('fs').writeFileSync(require('path').join(__dirname, '..', '..', 'data', 'db.json'), JSON.stringify(parsed, null, 2));
    res.json({ success: true, inquiry: inq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

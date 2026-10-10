const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (for Render.com, Heroku, Cloudflare etc.)
app.set('trust proxy', 1);

// Security Enhancements
app.disable('x-powered-by');
const { securityHeaders } = require('./src/middleware/security');
app.use(securityHeaders);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/coupons', require('./src/routes/coupons'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/contact', require('./src/routes/contact'));

// Public Store Settings (for customer storefront branding, customer care & limits)
app.get('/api/settings', (req, res) => {
  try {
    const db = require('./src/db');
    const settings = db.getSettings();
    res.json({
      success: true,
      settings: {
        storeName: settings.storeName,
        tagline: settings.tagline,
        announcementText: settings.announcementText,
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
        upiId: settings.upiId,
        merchantName: settings.merchantName,
        currency: settings.currency,
        currencySymbol: settings.currencySymbol,
        freeShippingThreshold: settings.freeShippingThreshold,
        enableCod: settings.enableCod,
        enableUpi: settings.enableUpi,
        enableCard: settings.enableCard
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fallback Clean Page Routes (SEO Friendly & Extensionless)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

app.get('/product', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/shipping-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shipping-policy.html'));
});

app.get('/refund-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'refund-policy.html'));
});

app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    store: 'ZAID\'S PERFUMES',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🌟 ZAID'S PERFUMES - Luxury E-Commerce Server Started`);
  console.log(`✨ Storefront:       http://localhost:${PORT}`);
  console.log(`👤 Customer Portal:  http://localhost:${PORT}/account.html`);
  console.log(`⚙️  Admin Panel:      http://localhost:${PORT}/admin/`);
  console.log(`🚀 API Base URL:     http://localhost:${PORT}/api/products`);
  console.log('====================================================');
});

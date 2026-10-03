const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Enhancements
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

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

// Fallback for Admin Panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Fallback for Account / Customer Portal
app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

// Fallback for Checkout
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

// Fallback for Product Details
app.get('/product', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
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

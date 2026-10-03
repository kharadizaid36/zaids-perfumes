const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Ensure directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { products: [], users: [], orders: [], coupons: [], reviews: [], settings: {} };
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { products: [], users: [], orders: [], coupons: [], reviews: [], settings: {} };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Product helpers
function getProducts(category, search) {
  const db = readDb();
  let list = db.products || [];
  if (category && category !== 'All' && category !== 'All Scents') {
    list = list.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => 
      p.title.toLowerCase().includes(q) || 
      (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.topNotes && p.topNotes.toLowerCase().includes(q))
    );
  }
  return list;
}

function getProductById(id) {
  const db = readDb();
  return (db.products || []).find(p => p.id === id || p.slug === id);
}

function addProduct(productData) {
  const db = readDb();
  const id = 'zp-prod-' + Date.now();
  const slug = (productData.title || 'perfume').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const newProduct = {
    id,
    slug,
    rating: 5.0,
    reviewCount: 1,
    ...productData,
    price: Number(productData.price) || 399,
    comparePrice: Number(productData.comparePrice) || 699,
    stock: Number(productData.stock) || 25,
    isFeatured: Boolean(productData.isFeatured)
  };
  db.products.unshift(newProduct);
  writeDb(db);
  return newProduct;
}

function updateProduct(id, updates) {
  const db = readDb();
  const index = (db.products || []).findIndex(p => p.id === id);
  if (index === -1) return null;
  db.products[index] = { 
    ...db.products[index], 
    ...updates,
    price: updates.price !== undefined ? Number(updates.price) : db.products[index].price,
    comparePrice: updates.comparePrice !== undefined ? Number(updates.comparePrice) : db.products[index].comparePrice,
    stock: updates.stock !== undefined ? Number(updates.stock) : db.products[index].stock
  };
  writeDb(db);
  return db.products[index];
}

function deleteProduct(id) {
  const db = readDb();
  const initialLen = db.products.length;
  db.products = (db.products || []).filter(p => p.id !== id);
  writeDb(db);
  return db.products.length < initialLen;
}

// Order helpers
function getOrders() {
  const db = readDb();
  return db.orders || [];
}

function getOrderById(id) {
  const db = readDb();
  return (db.orders || []).find(o => o.id.toUpperCase() === id.toUpperCase());
}

function getOrdersByEmailOrPhone(query) {
  const db = readDb();
  const q = query.toLowerCase().trim();
  return (db.orders || []).filter(o => 
    (o.customerEmail && o.customerEmail.toLowerCase() === q) ||
    (o.customerPhone && o.customerPhone.includes(q)) ||
    (o.userId && o.userId === q)
  );
}

function checkDuplicateUtr(utrNumber) {
  if (!utrNumber) return null;
  const db = readDb();
  const cleanUtr = String(utrNumber).trim();
  return (db.orders || []).find(o => 
    o.utrNumber && 
    String(o.utrNumber).trim() === cleanUtr && 
    o.paymentStatus !== 'Payment Rejected / Unverified'
  );
}

function createOrder(orderData) {
  const db = readDb();
  const orderNumber = 'ZP-' + Math.floor(1000 + Math.random() * 9000);
  const now = new Date();
  
  // Format readable time e.g., "03 Oct, 11:30 AM"
  const options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  const formattedTime = now.toLocaleDateString('en-GB', options);

  const isUpi = (orderData.paymentMethod || '').toUpperCase() === 'UPI';
  const isCod = (orderData.paymentMethod || '').toUpperCase() === 'COD';

  let initialPaymentStatus = 'Pending';
  let initialOrderStatus = 'Placed';
  let statusHistory = [];

  if (isUpi) {
    initialPaymentStatus = 'Verification Pending';
    initialOrderStatus = 'Payment Under Verification';
    statusHistory = [
      { status: 'Order Submitted', time: formattedTime, completed: true, current: false },
      { status: 'Bank UPI Verification', time: `Verifying UTR: ${orderData.utrNumber || 'N/A'}`, completed: false, current: true },
      { status: 'Packed & Quality Checked', time: 'Pending Approval', completed: false, current: false },
      { status: 'In Transit (Dispatched)', time: 'Pending', completed: false, current: false },
      { status: 'Delivered', time: 'Pending', completed: false, current: false }
    ];
  } else if (isCod) {
    initialPaymentStatus = 'Pending (COD)';
    initialOrderStatus = 'Placed';
    statusHistory = [
      { status: 'Order Placed', time: formattedTime, completed: true, current: true },
      { status: 'Packed & Quality Checked', time: 'In Progress', completed: false, current: false },
      { status: 'In Transit (Dispatched)', time: 'Pending', completed: false, current: false },
      { status: 'Delivered', time: 'Pending', completed: false, current: false }
    ];
  } else {
    initialPaymentStatus = 'Paid (Card)';
    initialOrderStatus = 'Placed';
    statusHistory = [
      { status: 'Payment Successful', time: formattedTime, completed: true, current: true },
      { status: 'Packed & Quality Checked', time: 'In Progress', completed: false, current: false },
      { status: 'In Transit (Dispatched)', time: 'Pending', completed: false, current: false },
      { status: 'Delivered', time: 'Pending', completed: false, current: false }
    ];
  }

  const newOrder = {
    id: orderNumber,
    createdAt: now.toISOString(),
    orderStatus: initialOrderStatus,
    paymentStatus: initialPaymentStatus,
    courierName: 'BlueDart Express',
    trackingNumber: 'AWB-' + Math.floor(1000000000 + Math.random() * 9000000000),
    statusHistory,
    utrNumber: orderData.utrNumber ? String(orderData.utrNumber).trim() : null,
    paymentProofUrl: orderData.paymentProofUrl || null,
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null,
    ...orderData
  };

  // Reduce product stock accordingly
  if (Array.isArray(orderData.items)) {
    orderData.items.forEach(item => {
      const prod = db.products.find(p => p.id === item.productId);
      if (prod && typeof prod.stock === 'number') {
        prod.stock = Math.max(0, prod.stock - (item.quantity || 1));
      }
    });
  }

  db.orders.unshift(newOrder);
  writeDb(db);
  return newOrder;
}

function updateOrderStatus(id, newStatus, courier, tracking) {
  const db = readDb();
  const order = (db.orders || []).find(o => o.id.toUpperCase() === id.toUpperCase());
  if (!order) return null;

  order.orderStatus = newStatus;
  if (courier) order.courierName = courier;
  if (tracking) order.trackingNumber = tracking;

  const now = new Date();
  const options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  const timeStr = now.toLocaleDateString('en-GB', options);

  // Update status history stepper
  const steps = ['Order Placed', 'Packed & Quality Checked', 'In Transit (Dispatched)', 'Delivered'];
  const statusMap = {
    'Placed': 0,
    'Processing': 1,
    'Packed': 1,
    'Shipped': 2,
    'In Transit': 2,
    'Delivered': 3,
    'Cancelled': -1
  };

  const currentStepIdx = statusMap[newStatus] !== undefined ? statusMap[newStatus] : 1;

  if (currentStepIdx >= 0) {
    order.statusHistory = steps.map((step, idx) => {
      return {
        status: step,
        time: idx <= currentStepIdx ? (idx === currentStepIdx ? timeStr : (order.statusHistory[idx]?.time || timeStr)) : 'Pending',
        completed: idx <= currentStepIdx,
        current: idx === currentStepIdx
      };
    });
  }

  writeDb(db);
  return order;
}

function verifyOrderPayment(id, action, adminUser = 'Admin', reason = '') {
  const db = readDb();
  const order = (db.orders || []).find(o => o.id.toUpperCase() === id.toUpperCase());
  if (!order) return null;

  const now = new Date();
  const options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  const formattedTime = now.toLocaleDateString('en-GB', options);

  if (action === 'approve') {
    order.paymentStatus = 'Paid (Verified via UTR)';
    order.orderStatus = 'Processing';
    order.verifiedAt = now.toISOString();
    order.verifiedBy = adminUser;
    order.rejectionReason = null;

    order.statusHistory = [
      { status: 'Order Submitted', time: order.statusHistory?.[0]?.time || formattedTime, completed: true, current: false },
      { status: 'Bank UPI Verified', time: `${formattedTime} by ${adminUser}`, completed: true, current: false },
      { status: 'Packed & Quality Checked', time: 'In Progress', completed: false, current: true },
      { status: 'In Transit (Dispatched)', time: 'Pending', completed: false, current: false },
      { status: 'Delivered', time: 'Pending', completed: false, current: false }
    ];
  } else if (action === 'reject') {
    order.paymentStatus = 'Payment Rejected / Unverified';
    order.orderStatus = 'Payment Failed';
    order.rejectionReason = reason || 'Payment not received in bank account. Invalid or unmatched UTR.';
    order.verifiedAt = now.toISOString();
    order.verifiedBy = adminUser;

    order.statusHistory = [
      { status: 'Order Submitted', time: order.statusHistory?.[0]?.time || formattedTime, completed: true, current: false },
      { status: 'Verification Failed', time: `${formattedTime} (${order.rejectionReason})`, completed: false, current: true }
    ];

    // Restore reserved product stock
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const prod = db.products.find(p => p.id === item.productId);
        if (prod && typeof prod.stock === 'number') {
          prod.stock += (item.quantity || 1);
        }
      });
    }
  }

  writeDb(db);
  return order;
}

// User / Auth helpers
function findUserByEmail(email) {
  const db = readDb();
  return (db.users || []).find(u => u.email.toLowerCase() === email.toLowerCase());
}

function createUser(userData) {
  const db = readDb();
  const id = 'usr-' + Date.now();
  const newUser = {
    id,
    role: 'customer',
    createdAt: new Date().toISOString(),
    ...userData
  };
  db.users.push(newUser);
  writeDb(db);
  return newUser;
}

function updateUser(id, updates) {
  const db = readDb();
  const index = (db.users || []).findIndex(u => u.id === id);
  if (index === -1) return null;
  db.users[index] = { ...db.users[index], ...updates };
  writeDb(db);
  return db.users[index];
}

// Coupon helpers
function getCoupons() {
  const db = readDb();
  return db.coupons || [];
}

function getCouponByCode(code) {
  const db = readDb();
  return (db.coupons || []).find(c => c.code.toUpperCase() === code.toUpperCase() && c.active);
}

function addCoupon(couponData) {
  const db = readDb();
  const newCoupon = {
    id: 'cpn-' + Date.now(),
    code: couponData.code.toUpperCase(),
    discountType: couponData.discountType || 'percentage',
    discountValue: Number(couponData.discountValue) || 10,
    minOrder: Number(couponData.minOrder) || 0,
    active: true,
    description: couponData.description || `Special discount on ZAID'S PERFUMES`
  };
  db.coupons.unshift(newCoupon);
  writeDb(db);
  return newCoupon;
}

function deleteCoupon(id) {
  const db = readDb();
  db.coupons = (db.coupons || []).filter(c => c.id !== id && c.code !== id);
  writeDb(db);
  return true;
}

// Settings helpers
function getSettings() {
  const db = readDb();
  return db.settings || {};
}

function updateSettings(newSettings) {
  const db = readDb();
  db.settings = { ...db.settings, ...newSettings };
  writeDb(db);
  return db.settings;
}

// Review helpers
function getReviews(productId) {
  const db = readDb();
  return (db.reviews || []).filter(r => !productId || r.productId === productId);
}

function addReview(reviewData) {
  const db = readDb();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const newReview = {
    id: 'rev-' + Date.now(),
    date: dateStr,
    ...reviewData,
    rating: Number(reviewData.rating) || 5
  };
  db.reviews.unshift(newReview);

  // Update product review count & average rating
  const product = db.products.find(p => p.id === reviewData.productId);
  if (product) {
    const productReviews = db.reviews.filter(r => r.productId === reviewData.productId);
    const avg = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
    product.rating = Math.round(avg * 10) / 10;
    product.reviewCount = productReviews.length;
  }

  writeDb(db);
  return newReview;
}

module.exports = {
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  getOrderById,
  getOrdersByEmailOrPhone,
  createOrder,
  updateOrderStatus,
  checkDuplicateUtr,
  verifyOrderPayment,
  findUserByEmail,
  createUser,
  updateUser,
  getCoupons,
  getCouponByCode,
  addCoupon,
  deleteCoupon,
  getSettings,
  updateSettings,
  getReviews,
  addReview
};

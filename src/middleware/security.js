/**
 * ZAID'S PERFUMES - Production Security Middleware Suite
 * Strict HTTP Headers, Anti-Spam Rate Limiters & Input Sanitization
 */

// 1. Production HTTP Security Headers Middleware
function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable legacy browser XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (disable unwanted browser features)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // HTTP Strict Transport Security (HSTS) - 1 year with preload
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content Security Policy (Allows trusted CDNs, Google Fonts, Tailwind, inline scripts and styles used by the luxury UI)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://cdn.tailwindcss.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "media-src 'self' data: blob:",
    "connect-src 'self' https://zaids-perfumes.onrender.com https://api.render.com",
    "frame-ancestors 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  next();
}

// 2. In-Memory Rate Limiting Engine
const rateLimitMaps = {
  orders: new Map(),
  contact: new Map()
};

/**
 * Factory for creating custom in-memory rate limiters
 * @param {string} type - Identifier for limiter storage
 * @param {number} maxRequests - Maximum allowed requests in window
 * @param {number} windowMs - Time window in milliseconds
 * @param {string} customMessage - User-friendly error message
 */
function createRateLimiter(type, maxRequests, windowMs, customMessage) {
  const map = rateLimitMaps[type];

  // Periodic garbage cleanup every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of map.entries()) {
      if (now - entry.startTime > windowMs * 2) {
        map.delete(ip);
      }
    }
  }, 10 * 60 * 1000);

  return function (req, res, next) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = map.get(clientIp);

    if (!entry) {
      map.set(clientIp, { count: 1, startTime: now });
      return next();
    }

    if (now - entry.startTime > windowMs) {
      // Window expired, reset counter
      map.set(clientIp, { count: 1, startTime: now });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      const waitMinutes = Math.ceil((windowMs - (now - entry.startTime)) / 60000);
      return res.status(429).json({
        success: false,
        message: customMessage || `Too many requests from your IP. Please try again in ${waitMinutes} minute(s).`
      });
    }

    next();
  };
}

// 5 orders per 10 minutes per IP
const orderRateLimiter = createRateLimiter(
  'orders',
  5,
  10 * 60 * 1000,
  'Order rate limit reached. To prevent duplicate orders, please wait a few moments before placing another order.'
);

// 5 contact inquiries per 15 minutes per IP
const contactRateLimiter = createRateLimiter(
  'contact',
  5,
  15 * 60 * 1000,
  'Too many messages submitted from your connection. Please wait a few minutes before sending another inquiry.'
);

// 3. Input Sanitization against XSS
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, tag => (tag === '<' ? '&lt;' : '&gt;'))
    .trim();
}

function sanitizeInput(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeInput(item));
  }
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      clean[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeInput(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

module.exports = {
  securityHeaders,
  orderRateLimiter,
  contactRateLimiter,
  sanitizeInput,
  sanitizeString
};

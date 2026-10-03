const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'zaids_luxury_perfumes_super_secret_jwt_key_2026';

// In-memory brute-force protection tracking
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Middleware: Verify JWT Bearer Token
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid authorization token'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Token has expired or is invalid'
    });
  }
}

/**
 * Middleware: Enforce Administrator Privileges
 */
function requireAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Administrator access required'
      });
    }
    next();
  });
}

/**
 * Rate Limiter for Admin Login attempts
 */
function adminLoginLimiter(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  const record = loginAttempts.get(clientIp);

  if (record) {
    if (now - record.firstAttempt > LOCKOUT_WINDOW_MS) {
      loginAttempts.delete(clientIp);
    } else if (record.count >= MAX_ATTEMPTS) {
      const remainingMinutes = Math.ceil((LOCKOUT_WINDOW_MS - (now - record.firstAttempt)) / 60000);
      return res.status(429).json({
        success: false,
        message: 'Too many failed admin login attempts. For security, access is temporarily locked. Please try again in ' + remainingMinutes + ' minute(s).'
      });
    }
  }

  next();
}

/**
 * Helper: Record failed login attempt
 */
function recordFailedAttempt(clientIp) {
  const now = Date.now();
  const record = loginAttempts.get(clientIp);

  if (!record || (now - record.firstAttempt > LOCKOUT_WINDOW_MS)) {
    loginAttempts.set(clientIp, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }
}

/**
 * Helper: Clear failed attempts on successful login
 */
function clearFailedAttempts(clientIp) {
  loginAttempts.delete(clientIp);
}

module.exports = {
  JWT_SECRET,
  verifyToken,
  requireAdmin,
  adminLoginLimiter,
  recordFailedAttempt,
  clearFailedAttempts
};

const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is active
    if (decoded.type === 'user') {
      const result = await db.query(
        'SELECT id, email, name, status FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0 || result.rows[0].status !== 'active') {
        return res.status(403).json({ error: 'User not found or inactive' });
      }

      req.user = result.rows[0];
      req.user.type = 'user';
    } else if (decoded.type === 'driver') {
      const result = await db.query(
        'SELECT id, email, name, status, verification_status FROM drivers WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Driver not found' });
      }

      req.user = result.rows[0];
      req.user.type = 'driver';
    } else if (decoded.type === 'admin') {
      const result = await db.query(
        'SELECT id, email, name, role FROM admin_users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Admin not found' });
      }

      req.user = result.rows[0];
      req.user.type = 'admin';
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireDriver = (req, res, next) => {
  if (req.user.type !== 'driver') {
    return res.status(403).json({ error: 'Driver access required' });
  }

  if (req.user.verification_status !== 'approved') {
    return res.status(403).json({ error: 'Driver not verified' });
  }

  next();
};

const requireUser = (req, res, next) => {
  if (req.user.type !== 'user') {
    return res.status(403).json({ error: 'User access required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireDriver,
  requireUser
};

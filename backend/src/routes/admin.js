const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../config/database');
const locationService = require('../services/locationService');
const bcrypt = require('bcrypt');

// Dashboard stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Total users
    const usersResult = await db.query('SELECT COUNT(*) FROM users WHERE status = $1', ['active']);

    // Total drivers
    const driversResult = await db.query(
      'SELECT COUNT(*) FROM drivers WHERE verification_status = $1',
      ['approved']
    );

    // Online drivers
    const onlineDrivers = await locationService.getOnlineDriversCount();

    // Active rides
    const activeRidesResult = await db.query(
      `SELECT COUNT(*) FROM rides
       WHERE status IN ('requested', 'accepted', 'driver_arrived', 'in_progress')`
    );

    // Today's stats
    const todayStatsResult = await db.query(
      `SELECT
         COUNT(*) as total_rides,
         SUM(fare_amount) as total_revenue,
         AVG(fare_amount) as avg_fare
       FROM rides
       WHERE DATE(completed_at) = CURRENT_DATE AND status = 'completed'`
    );

    const todayStats = todayStatsResult.rows[0];

    res.json({
      totalUsers: parseInt(usersResult.rows[0].count),
      totalDrivers: parseInt(driversResult.rows[0].count),
      onlineDrivers: onlineDrivers,
      activeRides: parseInt(activeRidesResult.rows[0].count),
      today: {
        totalRides: parseInt(todayStats.total_rides) || 0,
        totalRevenue: parseFloat(todayStats.total_revenue) || 0,
        avgFare: parseFloat(todayStats.avg_fare) || 0
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all users with pagination
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, email, phone, name, average_rating, total_rides, status, created_at
      FROM users
    `;

    const params = [];
    if (search) {
      query += ` WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const countQuery = search
      ? 'SELECT COUNT(*) FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1'
      : 'SELECT COUNT(*) FROM users';

    const countResult = await db.query(countQuery, search ? [`%${search}%`] : []);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all drivers with pagination
router.get('/drivers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '', search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, email, phone, name, vehicle_type, vehicle_make, vehicle_model,
             vehicle_plate, average_rating, total_rides, status, verification_status,
             created_at, approved_at
      FROM drivers
    `;

    const params = [];
    const conditions = [];

    if (status) {
      conditions.push(`verification_status = $${params.length + 1}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`(name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1} OR phone ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Count query
    let countQuery = 'SELECT COUNT(*) FROM drivers';
    const countParams = [];

    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
      countParams.push(...params.slice(0, params.length - 2));
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      drivers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// Approve driver
router.post('/drivers/:driverId/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { driverId } = req.params;

    await db.query(
      `UPDATE drivers
       SET verification_status = 'approved',
           approved_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [driverId]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve driver' });
  }
});

// Reject driver
router.post('/drivers/:driverId/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { reason } = req.body;

    await db.query(
      `UPDATE drivers
       SET verification_status = 'rejected'
       WHERE id = $1`,
      [driverId]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject driver' });
  }
});

// Get all rides with pagination
router.get('/rides', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*,
             u.name as passenger_name,
             d.name as driver_name
      FROM rides r
      LEFT JOIN users u ON r.passenger_id = u.id
      LEFT JOIN drivers d ON r.driver_id = d.id
    `;

    const params = [];
    if (status) {
      query += ` WHERE r.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY r.requested_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const countQuery = status
      ? 'SELECT COUNT(*) FROM rides WHERE status = $1'
      : 'SELECT COUNT(*) FROM rides';

    const countResult = await db.query(countQuery, status ? [status] : []);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      rides: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

// Create promo code
router.post('/promo-codes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      maxDiscount,
      minFareRequired,
      usageLimit,
      validFrom,
      validUntil
    } = req.body;

    const result = await db.query(
      `INSERT INTO promo_codes (
        code, discount_type, discount_value, max_discount,
        min_fare_required, usage_limit, valid_from, valid_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [code, discountType, discountValue, maxDiscount, minFareRequired, usageLimit, validFrom, validUntil]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create promo code' });
  }
});

// Get revenue report
router.get('/reports/revenue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await db.query(
      `SELECT
         DATE(completed_at) as date,
         COUNT(*) as total_rides,
         SUM(fare_amount) as total_revenue,
         AVG(fare_amount) as avg_fare,
         SUM(tip_amount) as total_tips
       FROM rides
       WHERE status = 'completed'
         AND completed_at >= $1
         AND completed_at <= $2
       GROUP BY DATE(completed_at)
       ORDER BY date DESC`,
      [startDate, endDate]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Create admin user
router.post('/create-admin', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if admin exists
    const existing = await db.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      'INSERT INTO admin_users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, passwordHash, name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticateToken, requireDriver } = require('../middleware/auth');
const locationService = require('../services/locationService');
const db = require('../config/database');

// Get driver profile
router.get('/profile', authenticateToken, requireDriver, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, phone, name, profile_photo_url,
              vehicle_type, vehicle_make, vehicle_model, vehicle_year,
              vehicle_color, vehicle_plate, average_rating, total_rides,
              acceptance_rate, cancellation_rate, status, verification_status,
              total_earnings, balance
       FROM drivers WHERE id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update driver profile
router.put('/profile', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { name, phone, profilePhotoUrl } = req.body;

    const result = await db.query(
      `UPDATE drivers
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           profile_photo_url = COALESCE($3, profile_photo_url)
       WHERE id = $4
       RETURNING *`,
      [name, phone, profilePhotoUrl, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get earnings summary
router.get('/earnings', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    let dateFilter;
    if (period === 'today') {
      dateFilter = "DATE(completed_at) = CURRENT_DATE";
    } else if (period === 'week') {
      dateFilter = "completed_at >= DATE_TRUNC('week', CURRENT_DATE)";
    } else if (period === 'month') {
      dateFilter = "completed_at >= DATE_TRUNC('month', CURRENT_DATE)";
    } else {
      dateFilter = "1=1"; // All time
    }

    const result = await db.query(
      `SELECT
         COUNT(*) as total_rides,
         SUM(fare_amount) as total_fare,
         SUM(tip_amount) as total_tips,
         AVG(fare_amount) as avg_fare
       FROM rides
       WHERE driver_id = $1 AND status = 'completed' AND ${dateFilter}`,
      [req.user.id]
    );

    const earnings = result.rows[0];
    const commission = parseFloat(process.env.COMMISSION_RATE) || 0.20;
    const netEarnings = (parseFloat(earnings.total_fare) || 0) * (1 - commission);

    res.json({
      totalRides: parseInt(earnings.total_rides) || 0,
      totalFare: parseFloat(earnings.total_fare) || 0,
      totalTips: parseFloat(earnings.total_tips) || 0,
      commission: commission * 100,
      netEarnings: netEarnings + (parseFloat(earnings.total_tips) || 0),
      avgFare: parseFloat(earnings.avg_fare) || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// Update driver status (online/offline)
router.put('/status', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['online', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await locationService.updateDriverStatus(req.user.id, status);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get performance metrics
router.get('/metrics', authenticateToken, requireDriver, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         average_rating,
         total_rides,
         acceptance_rate,
         cancellation_rate,
         total_earnings
       FROM drivers
       WHERE id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Upload document
router.post('/documents', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { documentType, documentUrl } = req.body;

    const validTypes = ['license', 'insurance', 'registration'];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const column = `${documentType}_document_url`;

    await db.query(
      `UPDATE drivers SET ${column} = $1 WHERE id = $2`,
      [documentUrl, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

module.exports = router;

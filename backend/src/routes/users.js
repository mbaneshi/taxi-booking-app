const express = require('express');
const router = express.Router();
const { authenticateToken, requireUser } = require('../middleware/auth');
const db = require('../config/database');

// Get user profile
router.get('/profile', authenticateToken, requireUser, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, phone, name, profile_photo_url,
              average_rating, total_rides, status
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, requireUser, async (req, res) => {
  try {
    const { name, phone, profilePhotoUrl } = req.body;

    const result = await db.query(
      `UPDATE users
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

// Get favorite locations
router.get('/favorites', authenticateToken, requireUser, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM favorite_locations WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Add favorite location
router.post('/favorites', authenticateToken, requireUser, async (req, res) => {
  try {
    const { label, address, latitude, longitude } = req.body;

    const result = await db.query(
      `INSERT INTO favorite_locations (user_id, label, address, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, label, address, latitude, longitude]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Delete favorite location
router.delete('/favorites/:favoriteId', authenticateToken, requireUser, async (req, res) => {
  try {
    const { favoriteId } = req.params;

    await db.query(
      'DELETE FROM favorite_locations WHERE id = $1 AND user_id = $2',
      [favoriteId, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete favorite' });
  }
});

module.exports = router;

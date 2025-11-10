const express = require('express');
const router = express.Router();
const { authenticateToken, requireUser, requireDriver } = require('../middleware/auth');
const rideMatchingService = require('../services/rideMatchingService');
const paymentService = require('../services/paymentService');
const db = require('../config/database');
const Joi = require('joi');

// Validation schemas
const createRideSchema = Joi.object({
  pickupLatitude: Joi.number().min(-90).max(90).required(),
  pickupLongitude: Joi.number().min(-180).max(180).required(),
  pickupAddress: Joi.string().required(),
  dropoffLatitude: Joi.number().min(-90).max(90).required(),
  dropoffLongitude: Joi.number().min(-180).max(180).required(),
  dropoffAddress: Joi.string().required(),
  vehicleType: Joi.string().valid('economy', 'premium', 'suv').default('economy'),
  paymentMethod: Joi.string().valid('card', 'cash').default('card'),
  passengerNotes: Joi.string().allow('').optional()
});

// Create new ride request
router.post('/', authenticateToken, requireUser, async (req, res) => {
  try {
    const { error } = createRideSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      pickupLatitude,
      pickupLongitude,
      pickupAddress,
      dropoffLatitude,
      dropoffLongitude,
      dropoffAddress,
      vehicleType,
      paymentMethod,
      passengerNotes
    } = req.body;

    // Calculate fare estimate
    const fareEstimate = await rideMatchingService.estimateFare(
      { latitude: pickupLatitude, longitude: pickupLongitude },
      { latitude: dropoffLatitude, longitude: dropoffLongitude },
      vehicleType
    );

    // Create ride in database
    const result = await db.query(
      `INSERT INTO rides (
        passenger_id, pickup_latitude, pickup_longitude, pickup_address,
        dropoff_latitude, dropoff_longitude, dropoff_address,
        vehicle_type, payment_method, passenger_notes,
        base_fare, distance_fare, time_fare, fare_amount, total_amount,
        distance_km, duration_minutes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $15, $16, 'requested')
      RETURNING *`,
      [
        req.user.id,
        pickupLatitude,
        pickupLongitude,
        pickupAddress,
        dropoffLatitude,
        dropoffLongitude,
        dropoffAddress,
        vehicleType,
        paymentMethod,
        passengerNotes || null,
        fareEstimate.baseFare,
        fareEstimate.distanceFare,
        fareEstimate.timeFare,
        fareEstimate.total,
        fareEstimate.estimatedDistance,
        fareEstimate.estimatedDuration
      ]
    );

    const ride = result.rows[0];

    // Start driver matching process asynchronously
    setImmediate(async () => {
      try {
        const driver = await rideMatchingService.findDriver(
          ride.id,
          { latitude: pickupLatitude, longitude: pickupLongitude },
          vehicleType
        );

        if (!driver) {
          // No driver found, update ride status
          await db.query(
            `UPDATE rides SET status = 'no_driver_found' WHERE id = $1`,
            [ride.id]
          );
        }
      } catch (error) {
        console.error('Driver matching error:', error);
      }
    });

    res.status(201).json(ride);
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ error: 'Failed to create ride' });
  }
});

// Get fare estimate
router.post('/estimate', authenticateToken, async (req, res) => {
  try {
    const {
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      vehicleType
    } = req.body;

    const estimate = await rideMatchingService.estimateFare(
      { latitude: pickupLatitude, longitude: pickupLongitude },
      { latitude: dropoffLatitude, longitude: dropoffLongitude },
      vehicleType || 'economy'
    );

    res.json(estimate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate estimate' });
  }
});

// Get ride details
router.get('/:rideId', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;

    const result = await db.query(
      `SELECT r.*,
              u.name as passenger_name, u.phone as passenger_phone,
              d.name as driver_name, d.phone as driver_phone,
              d.vehicle_make, d.vehicle_model, d.vehicle_color, d.vehicle_plate,
              d.average_rating as driver_rating
       FROM rides r
       LEFT JOIN users u ON r.passenger_id = u.id
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.id = $1`,
      [rideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const ride = result.rows[0];

    // Check access permissions
    if (req.user.type === 'user' && ride.passenger_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.type === 'driver' && ride.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ride details' });
  }
});

// Get ride history
router.get('/history/me', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query, params;

    if (req.user.type === 'user') {
      query = `
        SELECT r.*, d.name as driver_name, d.vehicle_make, d.vehicle_model,
               d.vehicle_color, d.vehicle_plate
        FROM rides r
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.passenger_id = $1 AND r.status IN ('completed', 'cancelled')
        ORDER BY r.requested_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [req.user.id, limit, offset];
    } else if (req.user.type === 'driver') {
      query = `
        SELECT r.*, u.name as passenger_name
        FROM rides r
        LEFT JOIN users u ON r.passenger_id = u.id
        WHERE r.driver_id = $1 AND r.status IN ('completed', 'cancelled')
        ORDER BY r.requested_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [req.user.id, limit, offset];
    }

    const result = await db.query(query, params);

    // Get total count
    const countQuery = req.user.type === 'user'
      ? 'SELECT COUNT(*) FROM rides WHERE passenger_id = $1 AND status IN (\'completed\', \'cancelled\')'
      : 'SELECT COUNT(*) FROM rides WHERE driver_id = $1 AND status IN (\'completed\', \'cancelled\')';

    const countResult = await db.query(countQuery, [req.user.id]);
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
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
});

// Accept ride (driver)
router.post('/:rideId/accept', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { rideId } = req.params;

    const ride = await rideMatchingService.acceptRide(req.user.id, rideId);
    res.json(ride);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reject ride (driver)
router.post('/:rideId/reject', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { rideId } = req.params;

    await rideMatchingService.rejectRide(req.user.id, rideId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Cancel ride
router.post('/:rideId/cancel', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    const cancelledBy = req.user.type === 'driver' ? 'driver' : 'passenger';

    const result = await db.query(
      `UPDATE rides
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           cancelled_by = $1,
           cancellation_reason = $2
       WHERE id = $3 AND status IN ('requested', 'accepted')
       RETURNING *`,
      [cancelledBy, reason, rideId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Cannot cancel ride' });
    }

    // If driver cancels, update their status back to online
    if (req.user.type === 'driver') {
      await db.query(
        'UPDATE drivers SET status = $1 WHERE id = $2',
        ['online', req.user.id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel ride' });
  }
});

// Rate ride
router.post('/:rideId/rate', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { rating, review } = req.body;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if ride exists and user is authorized
    const rideResult = await db.query(
      'SELECT passenger_id, driver_id, status FROM rides WHERE id = $1',
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const ride = rideResult.rows[0];

    if (ride.status !== 'completed') {
      return res.status(400).json({ error: 'Can only rate completed rides' });
    }

    let updateQuery, params;

    if (req.user.type === 'user' && ride.passenger_id === req.user.id) {
      // Passenger rating driver
      updateQuery = `
        INSERT INTO ratings (ride_id, driver_rating, driver_review, rated_by_passenger_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (ride_id) DO UPDATE
        SET driver_rating = $2, driver_review = $3, rated_by_passenger_at = CURRENT_TIMESTAMP
      `;
      params = [rideId, rating, review || null];
    } else if (req.user.type === 'driver' && ride.driver_id === req.user.id) {
      // Driver rating passenger
      updateQuery = `
        INSERT INTO ratings (ride_id, passenger_rating, passenger_review, rated_by_driver_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (ride_id) DO UPDATE
        SET passenger_rating = $2, passenger_review = $3, rated_by_driver_at = CURRENT_TIMESTAMP
      `;
      params = [rideId, rating, review || null];
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query(updateQuery, params);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// Add tip
router.post('/:rideId/tip', authenticateToken, requireUser, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { amount } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ error: 'Tip amount must be positive' });
    }

    await paymentService.addTip(rideId, amount);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get active ride
router.get('/active/current', authenticateToken, async (req, res) => {
  try {
    let query, params;

    if (req.user.type === 'user') {
      query = `
        SELECT r.*, d.name as driver_name, d.phone as driver_phone,
               d.vehicle_make, d.vehicle_model, d.vehicle_color, d.vehicle_plate,
               ST_Y(d.current_location::geometry) as driver_latitude,
               ST_X(d.current_location::geometry) as driver_longitude
        FROM rides r
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.passenger_id = $1 AND r.status IN ('requested', 'accepted', 'driver_arrived', 'in_progress')
        ORDER BY r.requested_at DESC
        LIMIT 1
      `;
      params = [req.user.id];
    } else if (req.user.type === 'driver') {
      query = `
        SELECT r.*, u.name as passenger_name, u.phone as passenger_phone
        FROM rides r
        LEFT JOIN users u ON r.passenger_id = u.id
        WHERE r.driver_id = $1 AND r.status IN ('accepted', 'driver_arrived', 'in_progress')
        ORDER BY r.accepted_at DESC
        LIMIT 1
      `;
      params = [req.user.id];
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active ride' });
  }
});

module.exports = router;

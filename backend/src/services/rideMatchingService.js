const db = require('../config/database');
const redisClient = require('../config/redis');
const locationService = require('./locationService');
const notificationService = require('./notificationService');

class RideMatchingService {
  async findDriver(rideId, pickupLocation, vehicleType) {
    const searchRadius = parseInt(process.env.DEFAULT_SEARCH_RADIUS) || 5000;
    const maxRadius = parseInt(process.env.MAX_SEARCH_RADIUS) || 10000;

    // Try with default radius first
    let drivers = await locationService.findNearbyDrivers(
      pickupLocation,
      searchRadius,
      vehicleType
    );

    // If no drivers found, expand search
    if (drivers.length === 0) {
      drivers = await locationService.findNearbyDrivers(
        pickupLocation,
        maxRadius,
        vehicleType
      );
    }

    if (drivers.length === 0) {
      return null;
    }

    // Score and rank drivers
    const scoredDrivers = drivers.map(driver => ({
      ...driver,
      score: this.calculateDriverScore(driver, pickupLocation)
    }));

    // Sort by score (highest first)
    scoredDrivers.sort((a, b) => b.score - a.score);

    // Notify top drivers sequentially
    const timeout = parseInt(process.env.DRIVER_TIMEOUT) || 20000;

    for (const driver of scoredDrivers.slice(0, 5)) {
      const accepted = await this.notifyDriver(driver.id, rideId, timeout);
      if (accepted) {
        return driver;
      }
    }

    return null;
  }

  calculateDriverScore(driver, pickupLocation) {
    // Distance score (closer is better, 0-100)
    const maxDistance = 10; // km
    const distanceScore = Math.max(0, 100 - (driver.distance_km / maxDistance) * 100);

    // Rating score (0-100)
    const ratingScore = driver.average_rating * 20;

    // Acceptance rate score (0-100)
    const acceptanceScore = driver.acceptance_rate || 100;

    // Experience score based on total rides
    const experienceScore = Math.min(100, (driver.total_rides / 100) * 100);

    // Weighted average
    const finalScore =
      distanceScore * 0.5 +
      ratingScore * 0.25 +
      acceptanceScore * 0.15 +
      experienceScore * 0.1;

    return finalScore;
  }

  async notifyDriver(driverId, rideId, timeout) {
    return new Promise(async (resolve) => {
      // Store notification in Redis with expiry
      await redisClient.setEx(
        `ride:${rideId}:notification:${driverId}`,
        timeout / 1000,
        JSON.stringify({ rideId, driverId, notifiedAt: Date.now() })
      );

      // Send push notification
      await notificationService.sendDriverRideRequest(driverId, rideId);

      // Set up timeout
      const timer = setTimeout(() => {
        this.cleanupNotification(rideId, driverId);
        resolve(false);
      }, timeout);

      // Listen for driver response
      const checkInterval = setInterval(async () => {
        const response = await redisClient.get(`ride:${rideId}:response:${driverId}`);

        if (response) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          await this.cleanupNotification(rideId, driverId);

          const data = JSON.parse(response);
          resolve(data.accepted);
        }
      }, 500);
    });
  }

  async acceptRide(driverId, rideId) {
    // Store acceptance in Redis
    await redisClient.setEx(
      `ride:${rideId}:response:${driverId}`,
      60,
      JSON.stringify({ accepted: true, timestamp: Date.now() })
    );

    // Update ride in database
    const result = await db.query(
      `UPDATE rides
       SET driver_id = $1, status = 'accepted', accepted_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'requested'
       RETURNING *`,
      [driverId, rideId]
    );

    if (result.rows.length === 0) {
      throw new Error('Ride not available');
    }

    // Update driver status
    await db.query(
      'UPDATE drivers SET status = $1 WHERE id = $2',
      ['busy', driverId]
    );

    // Send notification to passenger
    const ride = result.rows[0];
    await notificationService.sendPassengerRideAccepted(ride.passenger_id, rideId, driverId);

    return result.rows[0];
  }

  async rejectRide(driverId, rideId) {
    // Store rejection in Redis
    await redisClient.setEx(
      `ride:${rideId}:response:${driverId}`,
      60,
      JSON.stringify({ accepted: false, timestamp: Date.now() })
    );

    // Update driver metrics
    await this.updateDriverMetrics(driverId, 'rejection');

    return { success: true };
  }

  async updateDriverMetrics(driverId, action) {
    if (action === 'rejection') {
      await db.query(
        `UPDATE drivers
         SET acceptance_rate = (
           SELECT
             (COUNT(CASE WHEN status != 'cancelled' THEN 1 END)::float /
              NULLIF(COUNT(*), 0)) * 100
           FROM rides
           WHERE driver_id = $1
         )
         WHERE id = $1`,
        [driverId]
      );
    } else if (action === 'cancellation') {
      await db.query(
        `UPDATE drivers
         SET cancellation_rate = (
           SELECT
             (COUNT(CASE WHEN cancelled_by = 'driver' THEN 1 END)::float /
              NULLIF(COUNT(*), 0)) * 100
           FROM rides
           WHERE driver_id = $1 AND status = 'cancelled'
         )
         WHERE id = $1`,
        [driverId]
      );
    }
  }

  async cleanupNotification(rideId, driverId) {
    await redisClient.del(`ride:${rideId}:notification:${driverId}`);
    await redisClient.del(`ride:${rideId}:response:${driverId}`);
  }

  async estimateFare(pickupLocation, dropoffLocation, vehicleType = 'economy') {
    const distance = await locationService.calculateDistance(pickupLocation, dropoffLocation);

    // Pricing configuration
    const baseFare = parseFloat(process.env.BASE_FARE) || 3.50;
    const perKmRate = parseFloat(process.env.PER_KM_RATE) || 1.50;
    const perMinuteRate = parseFloat(process.env.PER_MINUTE_RATE) || 0.30;

    // Vehicle type multipliers
    const vehicleMultipliers = {
      economy: 1.0,
      premium: 1.5,
      suv: 1.8
    };

    const multiplier = vehicleMultipliers[vehicleType] || 1.0;

    // Estimate duration (assuming 30 km/h average speed)
    const estimatedDuration = (distance / 30) * 60; // in minutes

    // Calculate fare
    const distanceFare = distance * perKmRate;
    const timeFare = estimatedDuration * perMinuteRate;
    const subtotal = baseFare + distanceFare + timeFare;
    const total = subtotal * multiplier;

    return {
      baseFare,
      distanceFare: distanceFare * multiplier,
      timeFare: timeFare * multiplier,
      estimatedDistance: distance,
      estimatedDuration: Math.round(estimatedDuration),
      subtotal: Math.round(subtotal * 100) / 100,
      total: Math.round(total * 100) / 100,
      currency: 'CAD'
    };
  }

  async getSurgeMultiplier(location) {
    // Simple surge pricing based on demand
    // In production, this would be more sophisticated

    // Count active rides in the area
    const result = await db.query(
      `SELECT COUNT(*) as active_rides
       FROM rides
       WHERE status IN ('requested', 'accepted', 'in_progress')
         AND ST_DWithin(
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint(pickup_longitude, pickup_latitude), 4326)::geography,
           2000
         )`,
      [location.longitude, location.latitude]
    );

    const activeRides = parseInt(result.rows[0].active_rides);

    // Simple surge logic
    if (activeRides > 20) return 2.0;
    if (activeRides > 10) return 1.5;
    if (activeRides > 5) return 1.2;

    return 1.0;
  }
}

module.exports = new RideMatchingService();

const db = require('../config/database');
const redisClient = require('../config/redis');

class LocationService {
  async updateDriverLocation(driverId, location) {
    const { latitude, longitude, heading, speed } = location;

    // Update in PostgreSQL
    await db.query(
      `UPDATE drivers
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           last_location_update = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [longitude, latitude, driverId]
    );

    // Store in Redis with 5 minute TTL for fast access
    await redisClient.setEx(
      `driver:${driverId}:location`,
      300,
      JSON.stringify({
        latitude,
        longitude,
        heading: heading || 0,
        speed: speed || 0,
        timestamp: Date.now()
      })
    );

    return { success: true };
  }

  async getDriverLocation(driverId) {
    // Try Redis first
    const cached = await redisClient.get(`driver:${driverId}:location`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const result = await db.query(
      `SELECT
        ST_Y(current_location::geometry) as latitude,
        ST_X(current_location::geometry) as longitude,
        last_location_update
       FROM drivers
       WHERE id = $1`,
      [driverId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      latitude: result.rows[0].latitude,
      longitude: result.rows[0].longitude,
      timestamp: new Date(result.rows[0].last_location_update).getTime()
    };
  }

  async findNearbyDrivers(location, radiusMeters, vehicleType = null) {
    const { latitude, longitude } = location;

    let query = `
      SELECT
        id,
        name,
        vehicle_type,
        vehicle_make,
        vehicle_model,
        vehicle_color,
        vehicle_plate,
        average_rating,
        total_rides,
        acceptance_rate,
        ST_Distance(
          current_location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 AS distance_km,
        ST_Y(current_location::geometry) as latitude,
        ST_X(current_location::geometry) as longitude
      FROM drivers
      WHERE status = 'online'
        AND verification_status = 'approved'
        AND ST_DWithin(
          current_location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
    `;

    const params = [longitude, latitude, radiusMeters];

    if (vehicleType) {
      query += ` AND vehicle_type = $4`;
      params.push(vehicleType);
    }

    query += ` ORDER BY distance_km LIMIT 20`;

    const result = await db.query(query, params);
    return result.rows;
  }

  async calculateDistance(point1, point2) {
    const result = await db.query(
      `SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
      ) / 1000 AS distance_km`,
      [point1.longitude, point1.latitude, point2.longitude, point2.latitude]
    );

    return result.rows[0].distance_km;
  }

  calculateDistanceHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  async updateDriverStatus(driverId, status) {
    await db.query(
      'UPDATE drivers SET status = $1 WHERE id = $2',
      [status, driverId]
    );

    // If going offline, remove location from Redis
    if (status === 'offline') {
      await redisClient.del(`driver:${driverId}:location`);
    }

    return { success: true };
  }

  async getOnlineDriversCount() {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM drivers
       WHERE status = 'online' AND verification_status = 'approved'`
    );

    return parseInt(result.rows[0].count);
  }

  async getDriversInArea(bounds) {
    const { north, south, east, west } = bounds;

    const result = await db.query(
      `SELECT
        id,
        name,
        vehicle_type,
        status,
        ST_Y(current_location::geometry) as latitude,
        ST_X(current_location::geometry) as longitude
       FROM drivers
       WHERE status = 'online'
         AND verification_status = 'approved'
         AND current_location IS NOT NULL
         AND ST_Contains(
           ST_MakeEnvelope($1, $2, $3, $4, 4326),
           current_location::geometry
         )`,
      [west, south, east, north]
    );

    return result.rows;
  }
}

module.exports = new LocationService();

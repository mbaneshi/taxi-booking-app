const request = require('supertest');
const { app } = require('../../src/server');
const db = require('../../src/config/database');

// Mock database
jest.mock('../../src/config/database');
jest.mock('../../src/config/redis');
jest.mock('../../src/services/locationService');
jest.mock('../../src/services/notificationService');

describe('Rides API Integration Tests', () => {
  let authToken;
  let userId = 1;

  beforeAll(() => {
    // Mock authentication token
    authToken = 'Bearer mock-token-for-testing';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/rides - Create Ride', () => {
    it('should create a new ride request successfully', async () => {
      db.query = jest.fn().mockResolvedValue({
        rows: [{
          id: 1,
          passenger_id: userId,
          pickup_latitude: 43.6532,
          pickup_longitude: -79.3832,
          dropoff_latitude: 43.7532,
          dropoff_longitude: -79.4832,
          status: 'requested',
          fare_amount: 25.50,
        }],
      });

      const response = await request(app)
        .post('/api/rides')
        .set('Authorization', authToken)
        .send({
          pickupLatitude: 43.6532,
          pickupLongitude: -79.3832,
          pickupAddress: '123 Main St, Toronto',
          dropoffLatitude: 43.7532,
          dropoffLongitude: -79.4832,
          dropoffAddress: '456 Queen St, Toronto',
          vehicleType: 'economy',
          paymentMethod: 'card',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('requested');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/rides')
        .set('Authorization', authToken)
        .send({
          pickupLatitude: 43.6532,
          // Missing other required fields
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/rides/:id - Get Ride Details', () => {
    it('should return ride details for authorized user', async () => {
      const rideId = 1;
      db.query = jest.fn().mockResolvedValue({
        rows: [{
          id: rideId,
          passenger_id: userId,
          driver_id: 2,
          pickup_address: '123 Main St',
          dropoff_address: '456 Queen St',
          status: 'completed',
          fare_amount: 25.50,
        }],
      });

      const response = await request(app)
        .get(`/api/rides/${rideId}`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', rideId);
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent ride', async () => {
      db.query = jest.fn().mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/rides/99999')
        .set('Authorization', authToken);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/rides/estimate - Fare Estimation', () => {
    it('should return fare estimate for valid locations', async () => {
      const locationService = require('../../src/services/locationService');
      locationService.calculateDistance = jest.fn().mockResolvedValue(10);

      const response = await request(app)
        .post('/api/rides/estimate')
        .set('Authorization', authToken)
        .send({
          pickupLatitude: 43.6532,
          pickupLongitude: -79.3832,
          dropoffLatitude: 43.7532,
          dropoffLongitude: -79.4832,
          vehicleType: 'economy',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('baseFare');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('estimatedDistance');
      expect(response.body).toHaveProperty('estimatedDuration');
    });
  });

  describe('POST /api/rides/:id/cancel - Cancel Ride', () => {
    it('should cancel ride successfully', async () => {
      const rideId = 1;
      db.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: rideId,
            passenger_id: userId,
            status: 'requested',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: rideId,
            status: 'cancelled',
          }],
        });

      const response = await request(app)
        .post(`/api/rides/${rideId}/cancel`)
        .set('Authorization', authToken)
        .send({ reason: 'Changed plans' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'cancelled');
    });

    it('should not allow cancellation of completed ride', async () => {
      const rideId = 1;
      db.query = jest.fn().mockResolvedValue({
        rows: [{
          id: rideId,
          passenger_id: userId,
          status: 'completed',
        }],
      });

      const response = await request(app)
        .post(`/api/rides/${rideId}/cancel`)
        .set('Authorization', authToken)
        .send({ reason: 'Changed plans' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/rides - List User Rides', () => {
    it('should return paginated list of rides', async () => {
      db.query = jest.fn().mockResolvedValue({
        rows: [
          { id: 1, status: 'completed', created_at: new Date() },
          { id: 2, status: 'completed', created_at: new Date() },
        ],
      });

      const response = await request(app)
        .get('/api/rides')
        .set('Authorization', authToken)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.rides)).toBe(true);
    });
  });

  describe('POST /api/rides/:id/rate - Rate Ride', () => {
    it('should submit rating successfully', async () => {
      const rideId = 1;
      db.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: rideId,
            passenger_id: userId,
            status: 'completed',
            driver_id: 2,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE ride
        .mockResolvedValueOnce({ rows: [] }); // UPDATE driver rating

      const response = await request(app)
        .post(`/api/rides/${rideId}/rate`)
        .set('Authorization', authToken)
        .send({
          rating: 5,
          review: 'Excellent service!',
        });

      expect(response.status).toBe(200);
    });

    it('should reject invalid rating values', async () => {
      const response = await request(app)
        .post('/api/rides/1/rate')
        .set('Authorization', authToken)
        .send({
          rating: 6, // Invalid - should be 1-5
        });

      expect(response.status).toBe(400);
    });
  });
});

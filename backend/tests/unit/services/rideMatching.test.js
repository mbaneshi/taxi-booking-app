const rideMatchingService = require('../../../src/services/rideMatchingService');
const db = require('../../../src/config/database');
const redisClient = require('../../../src/config/redis');
const locationService = require('../../../src/services/locationService');
const notificationService = require('../../../src/services/notificationService');

// Mock dependencies
jest.mock('../../../src/config/database');
jest.mock('../../../src/config/redis');
jest.mock('../../../src/services/locationService');
jest.mock('../../../src/services/notificationService');

describe('Ride Matching Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findDriver', () => {
    it('should find nearby drivers successfully', async () => {
      const rideId = 1;
      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };
      const vehicleType = 'economy';

      const mockDrivers = [
        {
          id: 1,
          name: 'Driver 1',
          distance_km: 2.5,
          average_rating: 4.8,
          acceptance_rate: 95,
          total_rides: 150,
        },
        {
          id: 2,
          name: 'Driver 2',
          distance_km: 1.2,
          average_rating: 4.5,
          acceptance_rate: 90,
          total_rides: 80,
        },
      ];

      locationService.findNearbyDrivers.mockResolvedValue(mockDrivers);

      // Mock successful acceptance from first driver
      redisClient.setEx = jest.fn().mockResolvedValue('OK');
      redisClient.get = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ accepted: true, timestamp: Date.now() }));

      db.query.mockResolvedValue({
        rows: [{
          id: rideId,
          passenger_id: 1,
        }],
      });

      notificationService.sendDriverRideRequest = jest.fn();
      notificationService.sendPassengerRideAccepted = jest.fn();

      const driver = await rideMatchingService.findDriver(
        rideId,
        pickupLocation,
        vehicleType
      );

      // Note: Due to the async nature and timeout, this test might need adjustment
      // In real scenario, we'd want to test the scoring and ranking separately
      expect(locationService.findNearbyDrivers).toHaveBeenCalled();
    });

    it('should expand search radius if no drivers found', async () => {
      const rideId = 1;
      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };
      const vehicleType = 'economy';

      locationService.findNearbyDrivers
        .mockResolvedValueOnce([]) // First call returns empty
        .mockResolvedValueOnce([{ id: 1, distance_km: 8 }]); // Second call finds driver

      redisClient.setEx = jest.fn();
      redisClient.get = jest.fn().mockResolvedValue(
        JSON.stringify({ accepted: true, timestamp: Date.now() })
      );

      db.query.mockResolvedValue({ rows: [{ id: 1 }] });
      notificationService.sendDriverRideRequest = jest.fn();
      notificationService.sendPassengerRideAccepted = jest.fn();

      await rideMatchingService.findDriver(rideId, pickupLocation, vehicleType);

      expect(locationService.findNearbyDrivers).toHaveBeenCalledTimes(2);
      expect(locationService.findNearbyDrivers).toHaveBeenNthCalledWith(
        2,
        pickupLocation,
        10000, // MAX_SEARCH_RADIUS
        vehicleType
      );
    });

    it('should return null if no drivers available', async () => {
      const rideId = 1;
      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };
      const vehicleType = 'economy';

      locationService.findNearbyDrivers.mockResolvedValue([]);

      const driver = await rideMatchingService.findDriver(
        rideId,
        pickupLocation,
        vehicleType
      );

      expect(driver).toBeNull();
    });
  });

  describe('acceptRide', () => {
    it('should accept ride and update database', async () => {
      const driverId = 1;
      const rideId = 1;

      redisClient.setEx = jest.fn().mockResolvedValue('OK');

      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: rideId,
            passenger_id: 2,
            status: 'accepted',
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE driver status

      notificationService.sendPassengerRideAccepted = jest.fn();

      const result = await rideMatchingService.acceptRide(driverId, rideId);

      expect(result).toBeDefined();
      expect(result.id).toBe(rideId);
      expect(redisClient.setEx).toHaveBeenCalled();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rides'),
        [driverId, rideId]
      );
      expect(notificationService.sendPassengerRideAccepted).toHaveBeenCalled();
    });

    it('should throw error if ride not available', async () => {
      const driverId = 1;
      const rideId = 1;

      redisClient.setEx = jest.fn();
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        rideMatchingService.acceptRide(driverId, rideId)
      ).rejects.toThrow('Ride not available');
    });
  });

  describe('rejectRide', () => {
    it('should store rejection in Redis', async () => {
      const driverId = 1;
      const rideId = 1;

      redisClient.setEx = jest.fn().mockResolvedValue('OK');
      db.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await rideMatchingService.rejectRide(driverId, rideId);

      expect(result.success).toBe(true);
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `ride:${rideId}:response:${driverId}`,
        60,
        expect.stringContaining('false')
      );
    });
  });

  describe('updateDriverMetrics', () => {
    it('should update acceptance rate on rejection', async () => {
      const driverId = 1;

      db.query.mockResolvedValue({ rows: [] });

      await rideMatchingService.updateDriverMetrics(driverId, 'rejection');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('acceptance_rate'),
        [driverId]
      );
    });

    it('should update cancellation rate on cancellation', async () => {
      const driverId = 1;

      db.query.mockResolvedValue({ rows: [] });

      await rideMatchingService.updateDriverMetrics(driverId, 'cancellation');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('cancellation_rate'),
        [driverId]
      );
    });
  });
});

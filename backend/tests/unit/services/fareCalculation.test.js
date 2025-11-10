const rideMatchingService = require('../../../src/services/rideMatchingService');
const locationService = require('../../../src/services/locationService');

// Mock dependencies
jest.mock('../../../src/services/locationService');
jest.mock('../../../src/config/database');
jest.mock('../../../src/config/redis');

describe('Fare Calculation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('estimateFare', () => {
    it('should calculate fare correctly for economy vehicle', async () => {
      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };
      const dropoffLocation = { latitude: 43.7532, longitude: -79.4832 };

      locationService.calculateDistance.mockResolvedValue(15.5);

      const result = await rideMatchingService.estimateFare(
        pickupLocation,
        dropoffLocation,
        'economy'
      );

      expect(result).toBeDefined();
      expect(result.baseFare).toBe(3.50);
      expect(result.estimatedDistance).toBe(15.5);
      expect(result.total).toBeGreaterThan(result.baseFare);
      expect(result.currency).toBe('CAD');
      expect(result.distanceFare).toBeGreaterThan(0);
      expect(result.timeFare).toBeGreaterThan(0);
    });

    it('should apply premium vehicle multiplier correctly', async () => {
      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };
      const dropoffLocation = { latitude: 43.7532, longitude: -79.4832 };

      locationService.calculateDistance.mockResolvedValue(10);

      const economyFare = await rideMatchingService.estimateFare(
        pickupLocation,
        dropoffLocation,
        'economy'
      );

      const premiumFare = await rideMatchingService.estimateFare(
        pickupLocation,
        dropoffLocation,
        'premium'
      );

      expect(premiumFare.total).toBeGreaterThan(economyFare.total);
      expect(premiumFare.total).toBeCloseTo(economyFare.total * 1.5, 1);
    });

    it('should apply SUV vehicle multiplier correctly', async () => {
      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };
      const dropoffLocation = { latitude: 43.7532, longitude: -79.4832 };

      locationService.calculateDistance.mockResolvedValue(10);

      const economyFare = await rideMatchingService.estimateFare(
        pickupLocation,
        dropoffLocation,
        'economy'
      );

      const suvFare = await rideMatchingService.estimateFare(
        pickupLocation,
        dropoffLocation,
        'suv'
      );

      expect(suvFare.total).toBeGreaterThan(economyFare.total);
      expect(suvFare.total).toBeCloseTo(economyFare.total * 1.8, 1);
    });

    it('should calculate estimated duration based on distance', async () => {
      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };
      const dropoffLocation = { latitude: 43.7532, longitude: -79.4832 };

      locationService.calculateDistance.mockResolvedValue(30);

      const result = await rideMatchingService.estimateFare(
        pickupLocation,
        dropoffLocation,
        'economy'
      );

      // 30km at 30km/h = 60 minutes
      expect(result.estimatedDuration).toBe(60);
    });

    it('should include all fare components', async () => {
      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };
      const dropoffLocation = { latitude: 43.7532, longitude: -79.4832 };

      locationService.calculateDistance.mockResolvedValue(5);

      const result = await rideMatchingService.estimateFare(
        pickupLocation,
        dropoffLocation,
        'economy'
      );

      expect(result).toHaveProperty('baseFare');
      expect(result).toHaveProperty('distanceFare');
      expect(result).toHaveProperty('timeFare');
      expect(result).toHaveProperty('estimatedDistance');
      expect(result).toHaveProperty('estimatedDuration');
      expect(result).toHaveProperty('subtotal');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('currency');
    });
  });

  describe('calculateDriverScore', () => {
    it('should score driver based on multiple factors', () => {
      const driver = {
        id: 1,
        distance_km: 2,
        average_rating: 4.8,
        acceptance_rate: 95,
        total_rides: 150,
      };

      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };

      const score = rideMatchingService.calculateDriverScore(driver, pickupLocation);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give higher score to closer drivers', () => {
      const closeDriver = {
        distance_km: 1,
        average_rating: 4.5,
        acceptance_rate: 90,
        total_rides: 100,
      };

      const farDriver = {
        distance_km: 8,
        average_rating: 4.5,
        acceptance_rate: 90,
        total_rides: 100,
      };

      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };

      const closeScore = rideMatchingService.calculateDriverScore(closeDriver, pickupLocation);
      const farScore = rideMatchingService.calculateDriverScore(farDriver, pickupLocation);

      expect(closeScore).toBeGreaterThan(farScore);
    });

    it('should give higher score to higher rated drivers', () => {
      const highRated = {
        distance_km: 3,
        average_rating: 5.0,
        acceptance_rate: 90,
        total_rides: 100,
      };

      const lowRated = {
        distance_km: 3,
        average_rating: 3.5,
        acceptance_rate: 90,
        total_rides: 100,
      };

      const pickupLocation = { latitude: 43.6532, longitude: -79.3832 };

      const highScore = rideMatchingService.calculateDriverScore(highRated, pickupLocation);
      const lowScore = rideMatchingService.calculateDriverScore(lowRated, pickupLocation);

      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe('getSurgeMultiplier', () => {
    const db = require('../../../src/config/database');

    it('should return 1.0 when demand is low', async () => {
      db.query = jest.fn().mockResolvedValue({
        rows: [{ active_rides: 3 }],
      });

      const location = { latitude: 43.6532, longitude: -79.3832 };
      const multiplier = await rideMatchingService.getSurgeMultiplier(location);

      expect(multiplier).toBe(1.0);
    });

    it('should return 1.2 when demand is moderate', async () => {
      db.query = jest.fn().mockResolvedValue({
        rows: [{ active_rides: 7 }],
      });

      const location = { latitude: 43.6532, longitude: -79.3832 };
      const multiplier = await rideMatchingService.getSurgeMultiplier(location);

      expect(multiplier).toBe(1.2);
    });

    it('should return 1.5 when demand is high', async () => {
      db.query = jest.fn().mockResolvedValue({
        rows: [{ active_rides: 15 }],
      });

      const location = { latitude: 43.6532, longitude: -79.3832 };
      const multiplier = await rideMatchingService.getSurgeMultiplier(location);

      expect(multiplier).toBe(1.5);
    });

    it('should return 2.0 when demand is very high', async () => {
      db.query = jest.fn().mockResolvedValue({
        rows: [{ active_rides: 25 }],
      });

      const location = { latitude: 43.6532, longitude: -79.3832 };
      const multiplier = await rideMatchingService.getSurgeMultiplier(location);

      expect(multiplier).toBe(2.0);
    });
  });
});

// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
process.env.BASE_FARE = '3.50';
process.env.PER_KM_RATE = '1.50';
process.env.PER_MINUTE_RATE = '0.30';
process.env.DEFAULT_SEARCH_RADIUS = '5000';
process.env.MAX_SEARCH_RADIUS = '10000';
process.env.DRIVER_TIMEOUT = '20000';
process.env.COMMISSION_RATE = '0.20';
process.env.RATE_LIMIT_WINDOW = '15';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Increase timeout for all tests
jest.setTimeout(10000);

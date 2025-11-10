const paymentService = require('../../../src/services/paymentService');
const db = require('../../../src/config/database');
const notificationService = require('../../../src/services/notificationService');

// Mock dependencies
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
      update: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    paymentMethods: {
      attach: jest.fn().mockResolvedValue({}),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pm_test123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025,
        },
      }),
      detach: jest.fn().mockResolvedValue({}),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
      }),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({
        id: 'ref_test123',
        status: 'succeeded',
      }),
    },
  }));
});

jest.mock('../../../src/config/database');
jest.mock('../../../src/services/notificationService');

describe('Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query = jest.fn();
  });

  describe('createCustomer', () => {
    it('should create Stripe customer and update database', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      };

      db.query.mockResolvedValue({ rows: [] });

      const customer = await paymentService.createCustomer(user);

      expect(customer).toBeDefined();
      expect(customer.id).toBe('cus_test123');
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['cus_test123', 1]
      );
    });
  });

  describe('addPaymentMethod', () => {
    it('should add payment method for existing customer', async () => {
      const userId = 1;
      const paymentMethodId = 'pm_test123';

      db.query
        .mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_test123' }] })
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // COUNT

      const result = await paymentService.addPaymentMethod(userId, paymentMethodId);

      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBeDefined();
    });

    it('should create customer if none exists', async () => {
      const userId = 1;
      const paymentMethodId = 'pm_test123';

      db.query
        .mockResolvedValueOnce({ rows: [{ stripe_customer_id: null }] })
        .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', name: 'Test' }] })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE with customer ID
        .mockResolvedValueOnce({ rows: [] }) // INSERT payment method
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // COUNT

      const result = await paymentService.addPaymentMethod(userId, paymentMethodId);

      expect(result.success).toBe(true);
    });
  });

  describe('processRidePayment', () => {
    it('should process card payment successfully', async () => {
      const rideId = 1;

      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            passenger_id: 1,
            driver_id: 2,
            fare_amount: 25.50,
            payment_method: 'card',
            stripe_customer_id: 'cus_test123',
            email: 'test@example.com',
            name: 'Test User',
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE rides
        .mockResolvedValueOnce({ rows: [] }) // INSERT transactions
        .mockResolvedValueOnce({ rows: [] }); // UPDATE drivers

      notificationService.sendReceiptReady = jest.fn();

      const result = await paymentService.processRidePayment(rideId);

      expect(result.success).toBe(true);
      expect(result.paymentIntent).toBeDefined();
    });

    it('should process cash payment without Stripe', async () => {
      const rideId = 1;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          payment_method: 'cash',
        }],
      }).mockResolvedValueOnce({ rows: [] }); // UPDATE rides

      const result = await paymentService.processRidePayment(rideId);

      expect(result.success).toBe(true);
      expect(result.method).toBe('cash');
    });

    it('should handle payment failure', async () => {
      const rideId = 1;
      const stripe = require('stripe')();

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          passenger_id: 1,
          driver_id: 2,
          fare_amount: 25.50,
          payment_method: 'card',
          stripe_customer_id: 'cus_test123',
        }],
      });

      stripe.paymentIntents.create.mockRejectedValueOnce(
        new Error('Insufficient funds')
      );

      db.query
        .mockResolvedValueOnce({ rows: [] }) // UPDATE rides with error
        .mockResolvedValueOnce({ rows: [] }); // notification

      notificationService.sendPaymentFailed = jest.fn();

      const result = await paymentService.processRidePayment(rideId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(notificationService.sendPaymentFailed).toHaveBeenCalled();
    });
  });

  describe('validatePromoCode', () => {
    it('should validate active promo code correctly', async () => {
      const code = 'SAVE20';
      const userId = 1;
      const fareAmount = 30;

      db.query.mockResolvedValue({
        rows: [{
          code: 'SAVE20',
          discount_type: 'percentage',
          discount_value: 20,
          max_discount: null,
          min_fare_required: 10,
        }],
      });

      const result = await paymentService.validatePromoCode(code, userId, fareAmount);

      expect(result).toBeDefined();
      expect(result.code).toBe('SAVE20');
      expect(result.discountAmount).toBe(6); // 20% of 30
      expect(result.finalAmount).toBe(24);
    });

    it('should apply max discount cap for percentage promos', async () => {
      const code = 'SAVE50';
      const userId = 1;
      const fareAmount = 100;

      db.query.mockResolvedValue({
        rows: [{
          code: 'SAVE50',
          discount_type: 'percentage',
          discount_value: 50,
          max_discount: 20,
        }],
      });

      const result = await paymentService.validatePromoCode(code, userId, fareAmount);

      expect(result.discountAmount).toBe(20); // Capped at 20
      expect(result.finalAmount).toBe(80);
    });

    it('should handle fixed amount discount', async () => {
      const code = 'FLAT10';
      const userId = 1;
      const fareAmount = 30;

      db.query.mockResolvedValue({
        rows: [{
          code: 'FLAT10',
          discount_type: 'fixed',
          discount_value: 10,
        }],
      });

      const result = await paymentService.validatePromoCode(code, userId, fareAmount);

      expect(result.discountAmount).toBe(10);
      expect(result.finalAmount).toBe(20);
    });

    it('should return null for invalid code', async () => {
      const code = 'INVALID';
      const userId = 1;
      const fareAmount = 30;

      db.query.mockResolvedValue({ rows: [] });

      const result = await paymentService.validatePromoCode(code, userId, fareAmount);

      expect(result).toBeNull();
    });
  });

  describe('refundRide', () => {
    it('should process refund successfully', async () => {
      const rideId = 1;

      db.query
        .mockResolvedValueOnce({
          rows: [{
            payment_intent_id: 'pi_test123',
            fare_amount: 25.50,
            passenger_id: 1,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE rides

      notificationService.sendRefundProcessed = jest.fn();

      const result = await paymentService.refundRide(rideId);

      expect(result.success).toBe(true);
      expect(result.refund).toBeDefined();
      expect(notificationService.sendRefundProcessed).toHaveBeenCalled();
    });
  });
});

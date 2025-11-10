const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const notificationService = require('./notificationService');

class PaymentService {
  async createCustomer(user) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id
      }
    });

    await db.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, user.id]
    );

    return customer;
  }

  async addPaymentMethod(userId, paymentMethodId) {
    const result = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    if (!user.stripe_customer_id) {
      const userDetails = await db.query(
        'SELECT email, name FROM users WHERE id = $1',
        [userId]
      );
      const customer = await this.createCustomer(userDetails.rows[0]);
      user.stripe_customer_id = customer.id;
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripe_customer_id,
    });

    // Get payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Store in database
    await db.query(
      `INSERT INTO payment_methods (
        user_id, type, stripe_payment_method_id,
        card_brand, card_last4, card_exp_month, card_exp_year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        paymentMethod.type,
        paymentMethodId,
        paymentMethod.card?.brand,
        paymentMethod.card?.last4,
        paymentMethod.card?.exp_month,
        paymentMethod.card?.exp_year
      ]
    );

    // Set as default if it's the first payment method
    const count = await db.query(
      'SELECT COUNT(*) FROM payment_methods WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (parseInt(count.rows[0].count) === 1) {
      await this.setDefaultPaymentMethod(userId, paymentMethodId);
    }

    return { success: true, paymentMethod };
  }

  async setDefaultPaymentMethod(userId, paymentMethodId) {
    const result = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    // Update all payment methods to not default
    await db.query(
      'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
      [userId]
    );

    // Set new default
    await db.query(
      'UPDATE payment_methods SET is_default = true WHERE stripe_payment_method_id = $1',
      [paymentMethodId]
    );

    // Update Stripe customer
    await stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return { success: true };
  }

  async getPaymentMethods(userId) {
    const result = await db.query(
      `SELECT id, type, card_brand, card_last4, card_exp_month, card_exp_year, is_default
       FROM payment_methods
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async deletePaymentMethod(userId, paymentMethodId) {
    // Soft delete
    await db.query(
      `UPDATE payment_methods
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE stripe_payment_method_id = $1 AND user_id = $2`,
      [paymentMethodId, userId]
    );

    // Detach from Stripe
    await stripe.paymentMethods.detach(paymentMethodId);

    return { success: true };
  }

  async processRidePayment(rideId) {
    const ride = await db.query(
      `SELECT r.*, u.stripe_customer_id, u.email, u.name
       FROM rides r
       JOIN users u ON r.passenger_id = u.id
       WHERE r.id = $1`,
      [rideId]
    );

    if (ride.rows.length === 0) {
      throw new Error('Ride not found');
    }

    const rideData = ride.rows[0];

    if (rideData.payment_method === 'cash') {
      await db.query(
        `UPDATE rides SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [rideId]
      );
      return { success: true, method: 'cash' };
    }

    try {
      const amount = Math.round(rideData.fare_amount * 100); // Convert to cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'cad',
        customer: rideData.stripe_customer_id,
        description: `Ride #${rideId}`,
        metadata: {
          rideId: rideId,
          passengerId: rideData.passenger_id,
          driverId: rideData.driver_id
        },
        off_session: true,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      });

      // Update ride with payment info
      await db.query(
        `UPDATE rides
         SET payment_status = 'paid',
             payment_intent_id = $1,
             paid_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [paymentIntent.id, rideId]
      );

      // Create transaction record
      await db.query(
        `INSERT INTO transactions (
          user_id, driver_id, ride_id, type, amount, currency,
          payment_method, payment_gateway, gateway_transaction_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          rideData.passenger_id,
          rideData.driver_id,
          rideId,
          'ride_payment',
          rideData.fare_amount,
          'CAD',
          'card',
          'stripe',
          paymentIntent.id,
          'completed'
        ]
      );

      // Update driver earnings
      const commission = parseFloat(process.env.COMMISSION_RATE) || 0.20;
      const driverEarning = rideData.fare_amount * (1 - commission);

      await db.query(
        `UPDATE drivers
         SET total_earnings = total_earnings + $1,
             balance = balance + $1
         WHERE id = $2`,
        [driverEarning, rideData.driver_id]
      );

      // Send receipt
      await this.sendReceipt(rideId);

      return { success: true, paymentIntent };
    } catch (error) {
      console.error('Payment failed:', error);

      await db.query(
        `UPDATE rides
         SET payment_status = 'failed',
             payment_error = $1
         WHERE id = $2`,
        [error.message, rideId]
      );

      await notificationService.sendPaymentFailed(rideData.passenger_id, rideId);

      return { success: false, error: error.message };
    }
  }

  async addTip(rideId, tipAmount, paymentMethodId = null) {
    const ride = await db.query(
      `SELECT r.*, u.stripe_customer_id
       FROM rides r
       JOIN users u ON r.passenger_id = u.id
       WHERE r.id = $1`,
      [rideId]
    );

    if (ride.rows.length === 0) {
      throw new Error('Ride not found');
    }

    const rideData = ride.rows[0];
    const amount = Math.round(tipAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'cad',
      customer: rideData.stripe_customer_id,
      payment_method: paymentMethodId,
      description: `Tip for Ride #${rideId}`,
      metadata: {
        rideId: rideId,
        type: 'tip'
      },
      off_session: true,
      confirm: true
    });

    // Update ride with tip
    await db.query(
      `UPDATE rides
       SET tip_amount = $1,
           total_amount = fare_amount + $1
       WHERE id = $2`,
      [tipAmount, rideId]
    );

    // Update driver earnings
    await db.query(
      `UPDATE drivers
       SET total_earnings = total_earnings + $1,
           balance = balance + $1
       WHERE id = $2`,
      [tipAmount, rideData.driver_id]
    );

    // Create transaction record
    await db.query(
      `INSERT INTO transactions (
        user_id, driver_id, ride_id, type, amount, currency,
        payment_gateway, gateway_transaction_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        rideData.passenger_id,
        rideData.driver_id,
        rideId,
        'tip',
        tipAmount,
        'CAD',
        'stripe',
        paymentIntent.id,
        'completed'
      ]
    );

    return { success: true };
  }

  async refundRide(rideId, reason = 'requested_by_customer') {
    const ride = await db.query(
      'SELECT payment_intent_id, fare_amount, passenger_id FROM rides WHERE id = $1',
      [rideId]
    );

    if (ride.rows.length === 0) {
      throw new Error('Ride not found');
    }

    const rideData = ride.rows[0];

    const refund = await stripe.refunds.create({
      payment_intent: rideData.payment_intent_id,
      reason: reason,
    });

    await db.query(
      `UPDATE rides
       SET payment_status = 'refunded',
           refund_id = $1,
           refunded_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [refund.id, rideId]
    );

    await notificationService.sendRefundProcessed(rideData.passenger_id, rideId);

    return { success: true, refund };
  }

  async sendReceipt(rideId) {
    const result = await db.query(
      `SELECT
         r.*,
         u.email, u.name as passenger_name,
         d.name as driver_name,
         d.vehicle_model, d.vehicle_plate
       FROM rides r
       JOIN users u ON r.passenger_id = u.id
       JOIN drivers d ON r.driver_id = d.id
       WHERE r.id = $1`,
      [rideId]
    );

    if (result.rows.length === 0) {
      return;
    }

    const ride = result.rows[0];

    // In production, send actual email with PDF receipt
    // For now, just create notification
    await notificationService.sendReceiptReady(ride.passenger_id, rideId);

    return {
      rideId: ride.id,
      date: ride.completed_at,
      passengerName: ride.passenger_name,
      driverName: ride.driver_name,
      pickupAddress: ride.pickup_address,
      dropoffAddress: ride.dropoff_address,
      distance: ride.distance_km,
      duration: ride.duration_minutes,
      baseFare: ride.base_fare,
      distanceFare: ride.distance_fare,
      timeFare: ride.time_fare,
      subtotal: ride.fare_amount,
      tip: ride.tip_amount,
      total: ride.total_amount
    };
  }

  async validatePromoCode(code, userId, fareAmount) {
    const result = await db.query(
      `SELECT * FROM promo_codes
       WHERE code = $1
         AND is_active = true
         AND valid_from <= CURRENT_TIMESTAMP
         AND valid_until >= CURRENT_TIMESTAMP
         AND (usage_limit IS NULL OR usage_count < usage_limit)
         AND (min_fare_required IS NULL OR $2 >= min_fare_required)`,
      [code, fareAmount]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const promo = result.rows[0];

    let discountAmount = 0;
    if (promo.discount_type === 'percentage') {
      discountAmount = fareAmount * (promo.discount_value / 100);
      if (promo.max_discount) {
        discountAmount = Math.min(discountAmount, promo.max_discount);
      }
    } else if (promo.discount_type === 'fixed') {
      discountAmount = promo.discount_value;
    }

    return {
      code: promo.code,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round((fareAmount - discountAmount) * 100) / 100
    };
  }

  async applyPromoCode(rideId, code) {
    const ride = await db.query(
      'SELECT fare_amount FROM rides WHERE id = $1',
      [rideId]
    );

    if (ride.rows.length === 0) {
      throw new Error('Ride not found');
    }

    const promo = await this.validatePromoCode(code, null, ride.rows[0].fare_amount);

    if (!promo) {
      throw new Error('Invalid or expired promo code');
    }

    await db.query(
      `UPDATE rides
       SET promo_code = $1,
           discount_amount = $2,
           total_amount = fare_amount - $2
       WHERE id = $3`,
      [code, promo.discountAmount, rideId]
    );

    // Increment usage count
    await db.query(
      'UPDATE promo_codes SET usage_count = usage_count + 1 WHERE code = $1',
      [code]
    );

    return { success: true, discount: promo.discountAmount };
  }
}

module.exports = new PaymentService();

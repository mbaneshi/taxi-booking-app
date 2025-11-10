const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const notificationService = require('../services/notificationService');

// Stripe webhook endpoint - must use raw body
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object);
          break;

        case 'customer.created':
          console.log('Customer created:', event.data.object.id);
          break;

        case 'customer.deleted':
          console.log('Customer deleted:', event.data.object.id);
          break;

        case 'charge.refunded':
          await handleChargeRefunded(event.data.object);
          break;

        case 'payment_method.attached':
          console.log('Payment method attached:', event.data.object.id);
          break;

        case 'payment_method.detached':
          console.log('Payment method detached:', event.data.object.id);
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  const { rideId, passengerId } = paymentIntent.metadata;

  if (rideId) {
    // Update ride payment status
    await db.query(
      `UPDATE rides
       SET payment_status = 'paid',
           payment_intent_id = $1,
           paid_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [paymentIntent.id, rideId]
    );

    // Send notification
    if (passengerId) {
      await notificationService.sendReceiptReady(passengerId, rideId);
    }
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  const { rideId, passengerId } = paymentIntent.metadata;

  if (rideId) {
    // Update ride with failure
    await db.query(
      `UPDATE rides
       SET payment_status = 'failed',
           payment_error = $1
       WHERE id = $2`,
      [paymentIntent.last_payment_error?.message || 'Payment failed', rideId]
    );

    // Notify passenger
    if (passengerId) {
      await notificationService.sendPaymentFailed(passengerId, rideId);
    }
  }
}

async function handleChargeRefunded(charge) {
  console.log('Charge refunded:', charge.id);

  // Find ride by payment intent
  const result = await db.query(
    'SELECT id, passenger_id FROM rides WHERE payment_intent_id = $1',
    [charge.payment_intent]
  );

  if (result.rows.length > 0) {
    const { id: rideId, passenger_id } = result.rows[0];

    await db.query(
      `UPDATE rides
       SET payment_status = 'refunded',
           refunded_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [rideId]
    );

    await notificationService.sendRefundProcessed(passenger_id, rideId);
  }
}

module.exports = router;

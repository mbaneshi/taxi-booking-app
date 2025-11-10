const express = require('express');
const router = express.Router();
const { authenticateToken, requireUser } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Add payment method
router.post('/methods', authenticateToken, requireUser, async (req, res) => {
  try {
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID required' });
    }

    const result = await paymentService.addPaymentMethod(req.user.id, paymentMethodId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get payment methods
router.get('/methods', authenticateToken, requireUser, async (req, res) => {
  try {
    const methods = await paymentService.getPaymentMethods(req.user.id);
    res.json(methods);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Set default payment method
router.put('/methods/:paymentMethodId/default', authenticateToken, requireUser, async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    await paymentService.setDefaultPaymentMethod(req.user.id, paymentMethodId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete payment method
router.delete('/methods/:paymentMethodId', authenticateToken, requireUser, async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    await paymentService.deletePaymentMethod(req.user.id, paymentMethodId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create payment intent
router.post('/create-intent', authenticateToken, requireUser, async (req, res) => {
  try {
    const { amount } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'cad'
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Validate promo code
router.post('/promo/validate', authenticateToken, requireUser, async (req, res) => {
  try {
    const { code, fareAmount } = req.body;

    const promo = await paymentService.validatePromoCode(code, req.user.id, fareAmount);

    if (!promo) {
      return res.status(400).json({ error: 'Invalid or expired promo code' });
    }

    res.json(promo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('Payment succeeded:', event.data.object.id);
      break;

    case 'payment_intent.payment_failed':
      console.log('Payment failed:', event.data.object.id);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;

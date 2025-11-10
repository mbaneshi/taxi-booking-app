const admin = require('firebase-admin');
const db = require('../config/database');

// Initialize Firebase Admin (if credentials provided)
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      })
    });
  } catch (error) {
    console.warn('Firebase initialization skipped:', error.message);
  }
}

class NotificationService {
  async sendPushNotification(fcmToken, notification) {
    if (!admin.apps.length) {
      console.warn('Firebase not initialized, skipping push notification');
      return;
    }

    try {
      const message = {
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {}
      };

      const response = await admin.messaging().send(message);
      return response;
    } catch (error) {
      console.error('Push notification failed:', error);
      throw error;
    }
  }

  async storeNotification(userId, driverId, type, title, body, data = {}) {
    await db.query(
      `INSERT INTO notifications (user_id, driver_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, driverId, type, title, body, JSON.stringify(data)]
    );
  }

  async sendDriverRideRequest(driverId, rideId) {
    const ride = await db.query(
      `SELECT
         r.*,
         u.name as passenger_name,
         u.average_rating as passenger_rating
       FROM rides r
       JOIN users u ON r.passenger_id = u.id
       WHERE r.id = $1`,
      [rideId]
    );

    if (ride.rows.length === 0) return;

    const rideData = ride.rows[0];

    await this.storeNotification(
      null,
      driverId,
      'ride_request',
      'New Ride Request',
      `Pickup: ${rideData.pickup_address}`,
      {
        rideId,
        pickupAddress: rideData.pickup_address,
        dropoffAddress: rideData.dropoff_address,
        fareAmount: rideData.fare_amount
      }
    );

    // Send push notification if driver has FCM token
    const driver = await db.query(
      'SELECT fcm_token FROM drivers WHERE id = $1',
      [driverId]
    );

    if (driver.rows.length > 0 && driver.rows[0].fcm_token) {
      await this.sendPushNotification(driver.rows[0].fcm_token, {
        title: 'New Ride Request',
        body: `Pickup: ${rideData.pickup_address}`,
        data: { rideId, type: 'ride_request' }
      });
    }
  }

  async sendPassengerRideAccepted(passengerId, rideId, driverId) {
    const driver = await db.query(
      `SELECT name, vehicle_make, vehicle_model, vehicle_color, vehicle_plate, average_rating
       FROM drivers WHERE id = $1`,
      [driverId]
    );

    if (driver.rows.length === 0) return;

    const driverData = driver.rows[0];

    await this.storeNotification(
      passengerId,
      null,
      'ride_accepted',
      'Driver Found!',
      `${driverData.name} is on the way`,
      {
        rideId,
        driverId,
        driverName: driverData.name,
        vehicle: `${driverData.vehicle_color} ${driverData.vehicle_make} ${driverData.vehicle_model}`,
        plate: driverData.vehicle_plate
      }
    );
  }

  async sendDriverArrived(passengerId, rideId) {
    await this.storeNotification(
      passengerId,
      null,
      'driver_arrived',
      'Driver Arrived',
      'Your driver has arrived at the pickup location',
      { rideId }
    );
  }

  async sendRideStarted(passengerId, rideId) {
    await this.storeNotification(
      passengerId,
      null,
      'ride_started',
      'Ride Started',
      'Your ride has started',
      { rideId }
    );
  }

  async sendRideCompleted(passengerId, driverId, rideId) {
    await this.storeNotification(
      passengerId,
      null,
      'ride_completed',
      'Ride Completed',
      'Thank you for riding with us!',
      { rideId }
    );

    await this.storeNotification(
      null,
      driverId,
      'ride_completed',
      'Ride Completed',
      'Trip completed successfully',
      { rideId }
    );
  }

  async sendPaymentFailed(passengerId, rideId) {
    await this.storeNotification(
      passengerId,
      null,
      'payment_failed',
      'Payment Failed',
      'Please update your payment method',
      { rideId }
    );
  }

  async sendRefundProcessed(passengerId, rideId) {
    await this.storeNotification(
      passengerId,
      null,
      'refund_processed',
      'Refund Processed',
      'Your refund has been processed',
      { rideId }
    );
  }

  async sendReceiptReady(passengerId, rideId) {
    await this.storeNotification(
      passengerId,
      null,
      'receipt_ready',
      'Receipt Ready',
      'Your ride receipt is ready',
      { rideId }
    );
  }

  async sendDriverVerified(driverId) {
    await this.storeNotification(
      null,
      driverId,
      'driver_verified',
      'Account Verified',
      'Congratulations! Your account has been verified. You can now start accepting rides.',
      {}
    );
  }

  async getNotifications(userId, driverId, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const query = `
      SELECT * FROM notifications
      WHERE ${userId ? 'user_id = $1' : 'driver_id = $1'}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [userId || driverId, limit, offset]);

    return result.rows;
  }

  async markAsRead(notificationId) {
    await db.query(
      'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = $1',
      [notificationId]
    );
  }

  async markAllAsRead(userId, driverId) {
    const query = userId
      ? 'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = $1'
      : 'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE driver_id = $1';

    await db.query(query, [userId || driverId]);
  }

  async getUnreadCount(userId, driverId) {
    const query = userId
      ? 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false'
      : 'SELECT COUNT(*) as count FROM notifications WHERE driver_id = $1 AND is_read = false';

    const result = await db.query(query, [userId || driverId]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = new NotificationService();

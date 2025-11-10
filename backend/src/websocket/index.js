const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const locationService = require('../services/locationService');
const db = require('../config/database');

class WebSocketServer {
  constructor() {
    this.io = null;
    this.activeSockets = new Map();
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('WebSocket server initialized');
  }

  async authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userType = decoded.type;

      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  }

  handleConnection(socket) {
    console.log(`Client connected: ${socket.userId} (${socket.userType})`);

    // Store socket reference
    this.activeSockets.set(socket.userId, socket);

    // Join user's personal room
    socket.join(socket.userId);

    // Driver-specific events
    if (socket.userType === 'driver') {
      socket.on('location_update', (data) => this.handleLocationUpdate(socket, data));
      socket.on('go_online', () => this.handleDriverOnline(socket));
      socket.on('go_offline', () => this.handleDriverOffline(socket));
      socket.on('accept_ride', (data) => this.handleAcceptRide(socket, data));
      socket.on('reject_ride', (data) => this.handleRejectRide(socket, data));
      socket.on('arrived_at_pickup', (data) => this.handleArrivedAtPickup(socket, data));
      socket.on('start_ride', (data) => this.handleStartRide(socket, data));
      socket.on('complete_ride', (data) => this.handleCompleteRide(socket, data));
    }

    // Passenger-specific events
    if (socket.userType === 'user') {
      socket.on('subscribe_driver', (driverId) => this.handleSubscribeDriver(socket, driverId));
      socket.on('unsubscribe_driver', (driverId) => this.handleUnsubscribeDriver(socket, driverId));
    }

    // Common events
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  async handleLocationUpdate(socket, data) {
    try {
      const { latitude, longitude, heading, speed } = data;

      // Update location in database and Redis
      await locationService.updateDriverLocation(socket.userId, {
        latitude,
        longitude,
        heading,
        speed
      });

      // Get active ride for this driver
      const result = await db.query(
        `SELECT id, passenger_id, status
         FROM rides
         WHERE driver_id = $1 AND status IN ('accepted', 'in_progress')
         ORDER BY accepted_at DESC LIMIT 1`,
        [socket.userId]
      );

      if (result.rows.length > 0) {
        const ride = result.rows[0];

        // Broadcast location to passenger
        this.io.to(ride.passenger_id).emit('driver_location', {
          rideId: ride.id,
          driverId: socket.userId,
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          timestamp: Date.now()
        });
      }

      // Also broadcast to anyone tracking this driver
      this.io.to(`driver:${socket.userId}`).emit('driver_location', {
        driverId: socket.userId,
        latitude,
        longitude,
        heading: heading || 0,
        speed: speed || 0,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Location update error:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  }

  async handleDriverOnline(socket) {
    try {
      await locationService.updateDriverStatus(socket.userId, 'online');
      socket.emit('status_updated', { status: 'online' });
      console.log(`Driver ${socket.userId} is now online`);
    } catch (error) {
      console.error('Error going online:', error);
      socket.emit('error', { message: 'Failed to go online' });
    }
  }

  async handleDriverOffline(socket) {
    try {
      await locationService.updateDriverStatus(socket.userId, 'offline');
      socket.emit('status_updated', { status: 'offline' });
      console.log(`Driver ${socket.userId} is now offline`);
    } catch (error) {
      console.error('Error going offline:', error);
      socket.emit('error', { message: 'Failed to go offline' });
    }
  }

  async handleAcceptRide(socket, data) {
    const { rideId } = data;

    try {
      // Update ride status
      await db.query(
        `UPDATE rides
         SET driver_id = $1, status = 'accepted', accepted_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND status = 'requested'`,
        [socket.userId, rideId]
      );

      // Update driver status to busy
      await locationService.updateDriverStatus(socket.userId, 'busy');

      // Get ride details
      const result = await db.query(
        `SELECT * FROM rides WHERE id = $1`,
        [rideId]
      );

      const ride = result.rows[0];

      // Notify passenger
      this.io.to(ride.passenger_id).emit('ride_accepted', {
        rideId,
        driverId: socket.userId,
        driver: await this.getDriverInfo(socket.userId)
      });

      socket.emit('ride_accepted_success', { rideId });
    } catch (error) {
      console.error('Error accepting ride:', error);
      socket.emit('error', { message: 'Failed to accept ride' });
    }
  }

  async handleRejectRide(socket, data) {
    const { rideId } = data;

    try {
      socket.emit('ride_rejected_success', { rideId });
    } catch (error) {
      console.error('Error rejecting ride:', error);
    }
  }

  async handleArrivedAtPickup(socket, data) {
    const { rideId } = data;

    try {
      const result = await db.query(
        `UPDATE rides
         SET status = 'driver_arrived', driver_arrived_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND driver_id = $2
         RETURNING passenger_id`,
        [rideId, socket.userId]
      );

      if (result.rows.length > 0) {
        const ride = result.rows[0];
        this.io.to(ride.passenger_id).emit('driver_arrived', { rideId });
        socket.emit('arrived_confirmed', { rideId });
      }
    } catch (error) {
      console.error('Error marking arrival:', error);
      socket.emit('error', { message: 'Failed to mark arrival' });
    }
  }

  async handleStartRide(socket, data) {
    const { rideId } = data;

    try {
      const result = await db.query(
        `UPDATE rides
         SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND driver_id = $2
         RETURNING passenger_id`,
        [rideId, socket.userId]
      );

      if (result.rows.length > 0) {
        const ride = result.rows[0];
        this.io.to(ride.passenger_id).emit('ride_started', { rideId });
        socket.emit('ride_started_confirmed', { rideId });
      }
    } catch (error) {
      console.error('Error starting ride:', error);
      socket.emit('error', { message: 'Failed to start ride' });
    }
  }

  async handleCompleteRide(socket, data) {
    const { rideId, distanceKm, durationMinutes } = data;

    try {
      const result = await db.query(
        `UPDATE rides
         SET status = 'completed',
             completed_at = CURRENT_TIMESTAMP,
             distance_km = $1,
             duration_minutes = $2
         WHERE id = $3 AND driver_id = $4
         RETURNING passenger_id, fare_amount`,
        [distanceKm, durationMinutes, rideId, socket.userId]
      );

      if (result.rows.length > 0) {
        const ride = result.rows[0];

        // Update driver status back to online
        await locationService.updateDriverStatus(socket.userId, 'online');

        this.io.to(ride.passenger_id).emit('ride_completed', {
          rideId,
          fareAmount: ride.fare_amount
        });

        socket.emit('ride_completed_confirmed', { rideId });
      }
    } catch (error) {
      console.error('Error completing ride:', error);
      socket.emit('error', { message: 'Failed to complete ride' });
    }
  }

  handleSubscribeDriver(socket, driverId) {
    socket.join(`driver:${driverId}`);
    console.log(`User ${socket.userId} subscribed to driver ${driverId}`);
  }

  handleUnsubscribeDriver(socket, driverId) {
    socket.leave(`driver:${driverId}`);
    console.log(`User ${socket.userId} unsubscribed from driver ${driverId}`);
  }

  handleDisconnect(socket) {
    console.log(`Client disconnected: ${socket.userId}`);
    this.activeSockets.delete(socket.userId);
  }

  async getDriverInfo(driverId) {
    const result = await db.query(
      `SELECT id, name, phone, vehicle_type, vehicle_make, vehicle_model,
              vehicle_color, vehicle_plate, average_rating
       FROM drivers WHERE id = $1`,
      [driverId]
    );

    return result.rows[0];
  }

  // Helper method to emit to specific user
  emitToUser(userId, event, data) {
    this.io.to(userId).emit(event, data);
  }

  // Helper method to emit to all connected clients
  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

module.exports = new WebSocketServer();

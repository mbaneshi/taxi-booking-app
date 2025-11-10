import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = 'http://localhost:3000'; // Change for production

class WebSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  async connect() {
    const token = await AsyncStorage.getItem('token');

    if (!token) {
      throw new Error('No authentication token');
    }

    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.connected = true;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.connected = false;
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.connected = false;
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected;
  }

  // Driver events
  goOnline() {
    if (this.socket) {
      this.socket.emit('go_online');
    }
  }

  goOffline() {
    if (this.socket) {
      this.socket.emit('go_offline');
    }
  }

  updateLocation(location) {
    if (this.socket && this.connected) {
      this.socket.emit('location_update', location);
    }
  }

  acceptRide(rideId) {
    if (this.socket) {
      this.socket.emit('accept_ride', { rideId });
    }
  }

  rejectRide(rideId) {
    if (this.socket) {
      this.socket.emit('reject_ride', { rideId });
    }
  }

  arrivedAtPickup(rideId) {
    if (this.socket) {
      this.socket.emit('arrived_at_pickup', { rideId });
    }
  }

  startRide(rideId) {
    if (this.socket) {
      this.socket.emit('start_ride', { rideId });
    }
  }

  completeRide(rideId, distanceKm, durationMinutes) {
    if (this.socket) {
      this.socket.emit('complete_ride', { rideId, distanceKm, durationMinutes });
    }
  }

  // Event listeners
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export default new WebSocketService();

import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket && this.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);

      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);

      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    }
  }

  subscribeToDriver(driverId) {
    this.emit('subscribe_driver', driverId);
  }

  unsubscribeFromDriver(driverId) {
    this.emit('unsubscribe_driver', driverId);
  }

  onDriverLocation(callback) {
    this.on('driver_location', callback);
  }

  offDriverLocation(callback) {
    this.off('driver_location', callback);
  }

  onRideAccepted(callback) {
    this.on('ride_accepted', callback);
  }

  onDriverArrived(callback) {
    this.on('driver_arrived', callback);
  }

  onRideStarted(callback) {
    this.on('ride_started', callback);
  }

  onRideCompleted(callback) {
    this.on('ride_completed', callback);
  }
}

export default new WebSocketService();

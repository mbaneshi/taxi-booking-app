# REQUIREMENTS.md - Ride-Hailing Application

## Project Overview

Complete ride-hailing application for local taxi company with passenger and driver modes, real-time tracking, and payment processing.

**Budget:** CA $5,000 – $10,000
**Timeline:** 9 weeks (estimated)
**Platforms:** iOS and Android

---

## 1. TECHNICAL SPECIFICATIONS

### 1.1 Mobile App Framework

**Recommended: React Native (Cross-Platform)**

**Rationale:**
- Maximizes budget efficiency with shared codebase
- Single development team for both iOS and Android
- Large community and ecosystem
- Excellent real-time capability support
- Native performance for mapping and location services

**Alternative Options:**
- Flutter (Google's cross-platform framework)
- Native development (Swift for iOS, Kotlin for Android) - higher cost

**Required React Native Libraries:**
```
- react-native-maps (Google Maps integration)
- react-native-geolocation-service (GPS tracking)
- react-native-background-geolocation (background tracking)
- socket.io-client (real-time communication)
- @stripe/stripe-react-native (payment processing)
- @react-native-firebase/messaging (push notifications)
- react-navigation (app navigation)
- redux / redux-toolkit (state management)
- axios (API communication)
```

### 1.2 Backend Technology Stack

**Recommended Stack:**

**Option 1: Node.js (Recommended)**
```
- Runtime: Node.js v18+
- Framework: Express.js or NestJS
- WebSocket: Socket.io
- ORM: Sequelize (PostgreSQL) or Mongoose (MongoDB)
- Authentication: JWT + bcrypt
- Validation: Joi or Yup
```

**Option 2: Python**
```
- Framework: Django or FastAPI
- WebSocket: Django Channels or Socket.io
- ORM: Django ORM or SQLAlchemy
- Authentication: JWT + Django Auth
```

**Core Backend Services:**
- User Authentication & Authorization Service
- Ride Matching Engine
- Real-time Location Service
- Payment Processing Service
- Notification Service
- Analytics & Reporting Service
- Admin Management Service

### 1.3 Real-Time Location Service Architecture

**Architecture Design:**

```
┌─────────────┐
│ Driver App  │──┐
└─────────────┘  │
                 │ GPS Update (1-2s)
┌─────────────┐  │
│ Driver App  │──┤
└─────────────┘  │
                 ├──► WebSocket Server ──► Redis Pub/Sub
┌─────────────┐  │                              │
│ Driver App  │──┘                              │
└─────────────┘                                 │
                                                ▼
                ┌──────────────────────────────────┐
                │    Passenger Apps (Subscribers)  │
                └──────────────────────────────────┘
```

**Technology Components:**

1. **WebSocket Server (Socket.io)**
   - Handles bi-directional real-time communication
   - Manages connection state
   - Broadcasts location updates to relevant passengers

2. **Redis Pub/Sub**
   - High-performance message broker
   - Enables horizontal scaling
   - Sub-second latency for location broadcasts

3. **PostgreSQL with PostGIS Extension**
   - Geospatial data storage
   - Efficient radius queries for driver matching
   - Historical location data

**Implementation Requirements:**
- Driver location broadcast every 1-2 seconds
- Location data includes: latitude, longitude, heading, speed, timestamp
- Geofencing for service areas
- Battery optimization with adaptive update frequency
- Offline queue for location updates
- ETA calculation with traffic data

**Performance Targets:**
- Location update latency: <2 seconds
- Maximum simultaneous connections: 1,000+ drivers
- Bandwidth per driver: ~5-10 KB/s

### 1.4 Payment Gateway Integration

**Recommended: Stripe**

**Rationale:**
- Comprehensive API and documentation
- PCI-DSS Level 1 compliant (no compliance burden)
- Supports multiple payment methods
- Strong fraud prevention
- Excellent mobile SDK support
- Webhook support for async events

**Alternative Options:**
- PayPal/Braintree
- Square
- Adyen
- Authorize.net

**Payment Architecture:**

```
Mobile App → Backend API → Stripe API
    ↓            ↓             ↓
Tokenize     Process       Charge
  Card      Payment       Customer
             ↓
        Store Transaction
             ↓
        Webhook Handler
             ↓
        Update Ride Status
```

**Integration Components:**

1. **Client-Side (React Native):**
   - `@stripe/stripe-react-native` SDK
   - Card input collection
   - Payment method tokenization
   - Apple Pay / Google Pay integration
   - Payment confirmation UI

2. **Server-Side (Node.js):**
   - Stripe Node.js library
   - Payment Intent API
   - Customer management
   - Payment method storage
   - Webhook event handling
   - Refund processing

3. **Security Requirements:**
   - Never store raw card data
   - Use Stripe tokens only
   - Implement 3D Secure (SCA compliance)
   - Secure API key management
   - SSL/TLS encryption
   - Webhook signature verification

**Supported Payment Methods:**
- Credit/Debit Cards (Visa, Mastercard, Amex)
- Apple Pay (iOS)
- Google Pay (Android)
- Cash (tracked in app, no processing)
- Prepaid Wallet (optional)

---

## 2. FUNCTIONAL REQUIREMENTS

### 2.1 Passenger App Features

#### 2.1.1 User Registration & Authentication

**Features:**
- Email/password registration
- Phone number verification (OTP)
- Social login (Google, Apple, Facebook - optional)
- Profile management (name, photo, phone, email)
- Password reset functionality

**Acceptance Criteria:**
- User can register with email and phone in <60 seconds
- OTP received within 30 seconds
- Session persists across app restarts
- Secure password storage (bcrypt/Argon2)

#### 2.1.2 Ride Booking

**Features:**
- Set pickup location (current location or search)
- Set destination (search with autocomplete)
- View fare estimate before booking
- Select vehicle type (economy, premium, XL)
- Schedule rides for later (optional)
- Add ride notes for driver
- Promo code entry

**Acceptance Criteria:**
- Pickup/destination selection with <5 taps
- Fare estimate displayed within 2 seconds
- Address autocomplete with <500ms response
- Booking request sent to drivers within 1 second
- User receives driver match notification within 30 seconds (or timeout)

**User Flow:**
```
1. Open app → Current location detected
2. Tap "Where to?" → Enter destination
3. View fare estimate → Confirm booking
4. Wait for driver match → Receive notification
5. View driver details → Track driver arrival
```

#### 2.1.3 Real-Time Driver Tracking

**Features:**
- Live driver location on map
- Driver heading/direction indicator
- ETA to pickup location
- Driver vehicle details (model, color, plate)
- Driver photo and name
- Call/message driver (in-app)
- Share ride with friends (live tracking link)

**Acceptance Criteria:**
- Driver location updates every 1-2 seconds
- Location displayed with <2 second latency
- Smooth map animation (no jittering)
- ETA updates every 5 seconds
- Works on 3G/4G/5G networks

#### 2.1.4 In-App Payment

**Features:**
- Add multiple payment methods
- Credit/Debit card (saved securely)
- Apple Pay / Google Pay
- Cash option
- Default payment method selection
- Automatic fare calculation on trip end
- Tip driver (optional amount or percentage)
- Split payment (optional)
- Payment receipt (email and in-app)

**Acceptance Criteria:**
- Payment processed within 5 seconds of trip completion
- Payment confirmation displayed immediately
- Receipt generated and sent within 10 seconds
- Zero payment data stored locally
- Failed payment retry mechanism
- Refund processed within 3-5 business days

#### 2.1.5 Ride History

**Features:**
- List of all past rides
- Ride details (date, time, route, fare)
- Driver information
- Receipt download
- Repeat ride feature
- Filter by date range
- Search by destination

**Acceptance Criteria:**
- Load 50 recent rides within 2 seconds
- Infinite scroll for older rides
- Receipt downloadable as PDF
- Repeat ride books with 2 taps

#### 2.1.6 Driver Rating & Review

**Features:**
- 5-star rating system
- Optional written review
- Rating prompts immediately after ride
- View past ratings given
- Tip option on rating screen

**Acceptance Criteria:**
- Rating submitted within 3 taps
- Driver's average rating updated immediately
- Review character limit: 500 characters
- Cannot rate same ride twice
- Rating reflects in driver's profile instantly

#### 2.1.7 Additional Features

**Features:**
- Favorite locations (Home, Work, custom)
- Emergency SOS button (optional)
- Ride cancellation with policy
- Passenger support (in-app chat/tickets)
- Notifications (ride status updates)
- Multi-language support (optional)

### 2.2 Driver App Features

#### 2.2.1 Driver Registration & Verification

**Features:**
- Driver account creation
- Document upload (license, insurance, registration)
- Vehicle information (make, model, year, plate)
- Background check integration (optional)
- Admin approval workflow
- Driver profile management

**Acceptance Criteria:**
- Document upload supports PDF, JPG, PNG
- Admin notified immediately of new registrations
- Driver approval email sent upon acceptance
- Cannot go online until verified

#### 2.2.2 Ride Request Management

**Features:**
- Incoming ride request notifications
- Request details (pickup, destination, distance, fare)
- Accept/reject request (15-30 second timeout)
- Auto-assign option (optional)
- View passenger rating before accepting
- Audio/vibration alert for new requests

**Acceptance Criteria:**
- Request notification within 2 seconds
- Driver has 15-30 seconds to respond
- Request auto-declined if no response
- Next driver notified immediately
- Accept button easy to tap (large touch target)

#### 2.2.3 Navigation & Trip Management

**Features:**
- Turn-by-turn navigation to pickup
- Turn-by-turn navigation to destination
- "Arrived at pickup" button
- "Start trip" button
- "Complete trip" button
- Trip status updates to passenger
- In-app call/message passenger
- Cancel trip with reason

**Acceptance Criteria:**
- Navigation starts immediately on accept
- Status updates sent to passenger in real-time
- Trip cannot be completed before starting
- Fare automatically calculated on completion

#### 2.2.4 Availability Toggle

**Features:**
- Online/Offline toggle (large, visible)
- Automatic offline when no internet
- Break mode (temporarily unavailable)
- Shift tracking (optional)
- Location tracking only when online

**Acceptance Criteria:**
- Toggle responds within 500ms
- No ride requests when offline
- Location tracking stops when offline
- Battery saver mode when offline

#### 2.2.5 Earnings & Trip History

**Features:**
- Daily/weekly/monthly earnings summary
- Trip history with details
- Fare breakdown per trip
- Tips received
- Commission deductions
- Payout schedule information
- Downloadable earning reports

**Acceptance Criteria:**
- Earnings updated in real-time after trip
- History loads 100 trips in <3 seconds
- Filters by date range
- Export earnings as CSV/PDF

#### 2.2.6 Passenger Rating

**Features:**
- Rate passenger after trip (5 stars)
- Optional written feedback
- View passenger rating before accepting (optional)
- Cannot rate same trip twice

**Acceptance Criteria:**
- Rating prompt after trip completion
- Rating submitted within 3 taps
- Passenger's average rating updated immediately

#### 2.2.7 Performance Metrics

**Features:**
- Acceptance rate
- Cancellation rate
- Average rating
- Total trips completed
- Total earnings
- Customer satisfaction score

**Acceptance Criteria:**
- Metrics updated in real-time
- Historical trend graphs
- Benchmarking against averages (optional)

### 2.3 Real-Time Tracking Requirements

**Performance Targets:**
- Location update frequency: Every 1-2 seconds
- Update latency: <2 seconds end-to-end
- Map refresh rate: 30-60 FPS
- Geolocation accuracy: <10 meters
- Background tracking: Continuous when driver online

**Technical Implementation:**
- GPS: High accuracy mode when app active
- Background location: Significant location change API
- Battery optimization: Adaptive update frequency
- Network: Cellular and WiFi support
- Offline handling: Queue updates, sync when online

**Testing Requirements:**
- Test on 3G, 4G, 5G networks
- Test in areas with poor GPS signal
- Test battery drain over 8-hour shift
- Test with 100+ concurrent drivers

### 2.4 In-App Payment Processing

**Payment Flow:**
```
1. Trip Completed by Driver
2. Fare Calculated (base + distance + time + surge)
3. Payment Intent Created (Stripe)
4. Charge Customer's Default Payment Method
5. Process Payment
6. Send Webhook to Backend
7. Update Trip Status to "Paid"
8. Generate Receipt
9. Send Receipt to Passenger
10. Credit Driver Earnings
```

**Error Handling:**
- Insufficient funds: Prompt passenger to add payment method
- Payment failed: Retry up to 3 times
- Card declined: Email passenger with alternative payment link
- Network error: Queue payment, process when online

**Security Requirements:**
- PCI-DSS Level 1 compliance (via Stripe)
- Card tokenization (no raw card data stored)
- 3D Secure / SCA support
- Encrypted API communication (TLS 1.2+)
- Webhook signature verification
- Fraud detection (Stripe Radar)

### 2.5 Driver Rating System

**Rating Calculation:**
- Average of all ratings received
- Weighted by recency (optional)
- Minimum 10 rides before public rating
- Rating displayed to 1 decimal place (e.g., 4.8)

**Rating Thresholds:**
- Excellent: 4.8 - 5.0
- Good: 4.5 - 4.7
- Average: 4.0 - 4.4
- Below Average: <4.0 (warning/suspension)

**Acceptance Criteria:**
- Rating displays instantly after submission
- Average rating recalculated immediately
- Driver sees updated rating in profile
- Passengers see current rating before booking
- Rating history stored indefinitely

---

## 3. IMPLEMENTATION GUIDE

### 3.1 WebSocket / Real-Time Architecture

**Server Setup (Node.js + Socket.io):**

```javascript
// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

const redisClient = redis.createClient();
const subscriber = redisClient.duplicate();

// Driver connects and starts broadcasting location
io.on('connection', (socket) => {

  // Driver authentication
  socket.on('authenticate', async (token) => {
    const user = await verifyToken(token);
    socket.userId = user.id;
    socket.userType = user.type; // 'driver' or 'passenger'
    socket.join(user.id); // Join personal room
  });

  // Driver broadcasts location
  socket.on('location_update', async (data) => {
    if (socket.userType !== 'driver') return;

    const { latitude, longitude, heading, speed } = data;

    // Store in Redis with TTL
    await redisClient.setEx(
      `driver:${socket.userId}:location`,
      300, // 5 min expiry
      JSON.stringify({ latitude, longitude, heading, speed, timestamp: Date.now() })
    );

    // Get active ride for this driver
    const activeRide = await getActiveRide(socket.userId);

    if (activeRide && activeRide.passengerId) {
      // Broadcast to passenger
      io.to(activeRide.passengerId).emit('driver_location', {
        driverId: socket.userId,
        latitude,
        longitude,
        heading,
        speed,
        eta: await calculateETA(latitude, longitude, activeRide.pickupLocation)
      });
    }
  });

  // Passenger subscribes to driver location
  socket.on('subscribe_driver', (driverId) => {
    if (socket.userType !== 'passenger') return;
    socket.join(`driver:${driverId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.userId);
  });
});

server.listen(3000, () => {
  console.log('WebSocket server running on port 3000');
});
```

**Client Setup (React Native):**

```javascript
// locationService.js
import io from 'socket.io-client';
import Geolocation from 'react-native-geolocation-service';
import BackgroundGeolocation from 'react-native-background-geolocation';

class LocationService {
  constructor() {
    this.socket = null;
    this.locationInterval = null;
  }

  connect(authToken) {
    this.socket = io('https://api.taxiapp.com', {
      transports: ['websocket'],
      auth: { token: authToken }
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });
  }

  startBroadcasting() {
    // Foreground tracking
    this.locationInterval = setInterval(() => {
      Geolocation.getCurrentPosition(
        (position) => {
          this.socket.emit('location_update', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading: position.coords.heading,
            speed: position.coords.speed
          });
        },
        (error) => console.error(error),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
      );
    }, 2000); // Every 2 seconds

    // Background tracking
    BackgroundGeolocation.configure({
      desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
      stationaryRadius: 10,
      distanceFilter: 10,
      notificationTitle: 'Taxi App',
      notificationText: 'Tracking location',
      debug: false,
      startOnBoot: false,
      stopOnTerminate: true,
      locationProvider: BackgroundGeolocation.ACTIVITY_PROVIDER,
      interval: 2000,
      fastestInterval: 1000,
      activitiesInterval: 10000
    });

    BackgroundGeolocation.on('location', (location) => {
      this.socket.emit('location_update', {
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.bearing,
        speed: location.speed
      });
    });

    BackgroundGeolocation.start();
  }

  stopBroadcasting() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
    }
    BackgroundGeolocation.stop();
  }

  subscribeToDriver(driverId, callback) {
    this.socket.emit('subscribe_driver', driverId);
    this.socket.on('driver_location', callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export default new LocationService();
```

**Optimization Strategies:**
- Use Redis for caching active driver locations
- Implement geohashing for efficient proximity queries
- Batch location updates when bandwidth is limited
- Adaptive update frequency based on speed
- WebSocket compression (enable permessage-deflate)

### 3.2 Google Maps Integration

**Required APIs:**
- Maps SDK for iOS
- Maps SDK for Android
- Directions API
- Distance Matrix API
- Geocoding API
- Places API (autocomplete)

**Setup Steps:**

1. **Enable APIs in Google Cloud Console**
2. **Restrict API keys by platform**
3. **Install React Native Maps:**

```bash
npm install react-native-maps
```

**Implementation (React Native):**

```javascript
// MapScreen.js
import React, { useState, useEffect, useRef } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const MapScreen = () => {
  const [driverLocation, setDriverLocation] = useState(null);
  const [route, setRoute] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    // Subscribe to driver location updates
    locationService.subscribeToDriver(driverId, (location) => {
      setDriverLocation({
        latitude: location.latitude,
        longitude: location.longitude
      });

      // Animate map to show driver
      mapRef.current.animateCamera({
        center: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        zoom: 16
      });
    });
  }, []);

  const getDirections = async (origin, destination) => {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=YOUR_API_KEY`
    );
    const data = await response.json();

    if (data.routes.length) {
      const points = decodePolyline(data.routes[0].overview_polyline.points);
      setRoute(points);
    }
  };

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={{
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}
    >
      {driverLocation && (
        <Marker
          coordinate={driverLocation}
          title="Your Driver"
          description="Arriving soon"
        />
      )}

      {route.length > 0 && (
        <Polyline
          coordinates={route}
          strokeColor="#2196F3"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
};

export default MapScreen;
```

**Address Autocomplete:**

```javascript
<GooglePlacesAutocomplete
  placeholder="Enter destination"
  onPress={(data, details = null) => {
    const { lat, lng } = details.geometry.location;
    setDestination({ latitude: lat, longitude: lng });
  }}
  query={{
    key: 'YOUR_API_KEY',
    language: 'en',
  }}
  fetchDetails={true}
  enablePoweredByContainer={false}
/>
```

**Cost Optimization:**
- Cache geocoding results
- Use static maps for thumbnails
- Implement request throttling
- Monitor API usage in Cloud Console

### 3.3 Matchmaking Algorithm

**Driver Matching Logic:**

```javascript
// rideMatchingService.js

async function findDriver(pickupLocation, vehicleType) {
  // 1. Get all online drivers within radius
  const drivers = await getOnlineDrivers(pickupLocation, 5000); // 5km radius

  // 2. Filter by vehicle type
  const matchingDrivers = drivers.filter(d => d.vehicleType === vehicleType);

  // 3. Filter out busy drivers
  const availableDrivers = matchingDrivers.filter(d => d.status === 'available');

  // 4. Score and rank drivers
  const scoredDrivers = availableDrivers.map(driver => ({
    ...driver,
    score: calculateDriverScore(driver, pickupLocation)
  }));

  // 5. Sort by score (highest first)
  scoredDrivers.sort((a, b) => b.score - a.score);

  // 6. Notify top 3 drivers sequentially
  for (const driver of scoredDrivers.slice(0, 3)) {
    const accepted = await notifyDriver(driver.id, rideDetails, 20000); // 20s timeout
    if (accepted) {
      return driver;
    }
  }

  // No driver found
  return null;
}

function calculateDriverScore(driver, pickupLocation) {
  // Distance score (closer is better)
  const distance = calculateDistance(driver.location, pickupLocation);
  const distanceScore = Math.max(0, 100 - (distance / 100)); // 0-100

  // Rating score
  const ratingScore = driver.rating * 20; // 0-100 (5 star * 20)

  // Acceptance rate score
  const acceptanceScore = driver.acceptanceRate; // 0-100

  // Weighted average
  const finalScore = (distanceScore * 0.6) + (ratingScore * 0.3) + (acceptanceScore * 0.1);

  return finalScore;
}

async function getOnlineDrivers(location, radiusMeters) {
  // Using PostGIS for geospatial query
  const query = `
    SELECT * FROM drivers
    WHERE status = 'online'
    AND ST_DWithin(
      location::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
  `;

  return await db.query(query, [location.longitude, location.latitude, radiusMeters]);
}

function calculateDistance(loc1, loc2) {
  // Haversine formula
  const R = 6371e3; // Earth radius in meters
  const φ1 = loc1.latitude * Math.PI / 180;
  const φ2 = loc2.latitude * Math.PI / 180;
  const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

async function notifyDriver(driverId, rideDetails, timeout) {
  return new Promise((resolve) => {
    // Send push notification
    sendPushNotification(driverId, {
      title: 'New Ride Request',
      body: `Pickup: ${rideDetails.pickupAddress}`,
      data: rideDetails
    });

    // Emit via WebSocket
    io.to(driverId).emit('ride_request', {
      ...rideDetails,
      expiresAt: Date.now() + timeout
    });

    // Wait for response or timeout
    const responseHandler = (accepted) => {
      clearTimeout(timer);
      resolve(accepted);
    };

    const timer = setTimeout(() => {
      resolve(false); // Timeout
    }, timeout);

    // Listen for driver response
    io.once(`ride_response:${driverId}`, responseHandler);
  });
}
```

**Algorithm Features:**
- Proximity-based matching (closest drivers first)
- Driver rating consideration
- Sequential notification (not broadcast)
- Automatic timeout and re-assignment
- Fallback to wider radius if no drivers

### 3.4 Payment Flow Implementation

**Backend Payment Service:**

```javascript
// paymentService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentService {

  // Create customer on user registration
  async createCustomer(user) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id
      }
    });

    // Save Stripe customer ID to database
    await db.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, user.id]
    );

    return customer;
  }

  // Add payment method
  async addPaymentMethod(userId, paymentMethodId) {
    const user = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId]);

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripe_customer_id,
    });

    // Set as default payment method
    await stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return { success: true };
  }

  // Process ride payment
  async processRidePayment(rideId) {
    const ride = await db.query(`
      SELECT r.*, u.stripe_customer_id, r.fare_amount
      FROM rides r
      JOIN users u ON r.passenger_id = u.id
      WHERE r.id = $1
    `, [rideId]);

    try {
      // Create Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(ride.fare_amount * 100), // Convert to cents
        currency: 'cad',
        customer: ride.stripe_customer_id,
        description: `Ride #${rideId}`,
        metadata: {
          rideId: rideId,
          passengerId: ride.passenger_id,
          driverId: ride.driver_id
        },
        off_session: true, // Customer not present
        confirm: true, // Automatically confirm payment
      });

      // Update ride with payment info
      await db.query(`
        UPDATE rides
        SET payment_status = 'paid',
            payment_intent_id = $1,
            paid_at = NOW()
        WHERE id = $2
      `, [paymentIntent.id, rideId]);

      // Send receipt
      await this.sendReceipt(rideId);

      return { success: true, paymentIntent };

    } catch (error) {
      console.error('Payment failed:', error);

      // Update ride with failed payment
      await db.query(`
        UPDATE rides
        SET payment_status = 'failed',
            payment_error = $1
        WHERE id = $2
      `, [error.message, rideId]);

      // Notify passenger of payment failure
      await notifyPassenger(ride.passenger_id, {
        title: 'Payment Failed',
        body: 'Please update your payment method'
      });

      return { success: false, error: error.message };
    }
  }

  // Handle tip
  async addTip(rideId, tipAmount) {
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);

    // Create additional charge for tip
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(tipAmount * 100),
      currency: 'cad',
      customer: ride.stripe_customer_id,
      description: `Tip for Ride #${rideId}`,
      metadata: {
        rideId: rideId,
        type: 'tip'
      },
      off_session: true,
      confirm: true,
    });

    // Update ride with tip
    await db.query(`
      UPDATE rides
      SET tip_amount = $1,
          total_amount = fare_amount + $1
      WHERE id = $2
    `, [tipAmount, rideId]);

    return { success: true };
  }

  // Process refund
  async refundRide(rideId, reason) {
    const ride = await db.query(
      'SELECT payment_intent_id, fare_amount FROM rides WHERE id = $1',
      [rideId]
    );

    const refund = await stripe.refunds.create({
      payment_intent: ride.payment_intent_id,
      reason: reason, // 'duplicate', 'fraudulent', 'requested_by_customer'
    });

    await db.query(`
      UPDATE rides
      SET payment_status = 'refunded',
          refund_id = $1,
          refunded_at = NOW()
      WHERE id = $2
    `, [refund.id, rideId]);

    return { success: true, refund };
  }

  // Generate receipt
  async sendReceipt(rideId) {
    const ride = await db.query(`
      SELECT r.*, u.email, u.name,
             d.name as driver_name,
             d.vehicle_model, d.vehicle_plate
      FROM rides r
      JOIN users u ON r.passenger_id = u.id
      JOIN drivers d ON r.driver_id = d.id
      WHERE r.id = $1
    `, [rideId]);

    const receiptData = {
      rideId: ride.id,
      date: ride.completed_at,
      passengerName: ride.name,
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

    // Generate PDF receipt (using library like pdfkit)
    const pdfBuffer = await generateReceiptPDF(receiptData);

    // Send email with receipt
    await sendEmail({
      to: ride.email,
      subject: `Receipt for Ride #${rideId}`,
      text: `Thank you for riding with us!`,
      attachments: [
        {
          filename: `receipt-${rideId}.pdf`,
          content: pdfBuffer
        }
      ]
    });

    return receiptData;
  }
}

// Webhook handler for Stripe events
app.post('/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      // Additional processing if needed
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      // Notify passenger, attempt recovery
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

module.exports = new PaymentService();
```

**Client-Side Payment (React Native):**

```javascript
// PaymentScreen.js
import { useStripe } from '@stripe/stripe-react-native';

const PaymentScreen = () => {
  const { createPaymentMethod, confirmPayment } = useStripe();

  const handleAddCard = async (cardDetails) => {
    const { paymentMethod, error } = await createPaymentMethod({
      paymentMethodType: 'Card',
      card: cardDetails,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    // Send payment method to backend
    await api.post('/payment-methods', {
      paymentMethodId: paymentMethod.id
    });

    Alert.alert('Success', 'Card added successfully');
  };

  return (
    <CardField
      postalCodeEnabled={true}
      onCardChange={(cardDetails) => {
        console.log('Card details:', cardDetails);
      }}
      style={{ height: 50, marginVertical: 20 }}
    />
  );
};
```

### 3.5 Admin Dashboard Components

**Dashboard Features:**

1. **Overview Page**
   - Total rides today/week/month
   - Active rides right now
   - Total revenue
   - Active drivers online
   - Key metrics and charts

2. **Ride Monitoring**
   - Live map with all active rides
   - Ride status (requested, en route, in progress, completed)
   - Ride details on click
   - Ability to cancel rides
   - Customer support chat integration

3. **User Management**
   - List all passengers
   - Search by name, email, phone
   - View ride history
   - Block/unblock users
   - View payment methods
   - Issue refunds

4. **Driver Management**
   - Pending approvals (new drivers)
   - Active drivers
   - Driver verification documents
   - Approve/reject drivers
   - View earnings and payouts
   - Performance metrics
   - Suspend/ban drivers

5. **Payment Oversight**
   - Transaction history
   - Failed payments
   - Pending payouts to drivers
   - Revenue reports
   - Refund management

6. **Pricing Configuration**
   - Set base fare
   - Per-km rate
   - Per-minute rate
   - Surge pricing rules
   - Promo code management
   - Commission rates

7. **Analytics & Reports**
   - Revenue trends
   - Ride volume trends
   - Driver performance
   - Passenger retention
   - Average ratings
   - Geographic heat maps

**Technology Stack:**
- Frontend: React or Next.js
- UI Library: Material-UI or Ant Design
- Charts: Recharts or Chart.js
- Maps: Google Maps JavaScript API
- State Management: Redux or Context API

---

## 4. DATABASE SCHEMA

### 4.1 Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  profile_photo_url VARCHAR(500),
  stripe_customer_id VARCHAR(100),
  average_rating DECIMAL(3,2) DEFAULT 5.0,
  total_rides INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, deleted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
```

### 4.2 Drivers Table

```sql
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  profile_photo_url VARCHAR(500),

  -- Vehicle information
  vehicle_type VARCHAR(50), -- economy, premium, suv
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_year INT,
  vehicle_color VARCHAR(50),
  vehicle_plate VARCHAR(20),

  -- Verification
  license_number VARCHAR(50),
  license_expiry DATE,
  license_document_url VARCHAR(500),
  insurance_document_url VARCHAR(500),
  registration_document_url VARCHAR(500),
  background_check_status VARCHAR(20), -- pending, approved, rejected
  verification_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected

  -- Performance metrics
  average_rating DECIMAL(3,2) DEFAULT 5.0,
  total_rides INT DEFAULT 0,
  acceptance_rate DECIMAL(5,2) DEFAULT 100.0,
  cancellation_rate DECIMAL(5,2) DEFAULT 0.0,

  -- Status
  status VARCHAR(20) DEFAULT 'offline', -- online, offline, busy, suspended
  current_location GEOGRAPHY(POINT, 4326),
  last_location_update TIMESTAMP,

  -- Earnings
  total_earnings DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP
);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_verification ON drivers(verification_status);
CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location);
```

### 4.3 Rides Table

```sql
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  passenger_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES drivers(id),

  -- Locations
  pickup_latitude DECIMAL(10,8) NOT NULL,
  pickup_longitude DECIMAL(11,8) NOT NULL,
  pickup_address TEXT,
  dropoff_latitude DECIMAL(10,8) NOT NULL,
  dropoff_longitude DECIMAL(11,8) NOT NULL,
  dropoff_address TEXT,

  -- Ride details
  vehicle_type VARCHAR(50),
  distance_km DECIMAL(8,2),
  duration_minutes INT,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'requested',
  -- requested, accepted, driver_arrived, in_progress, completed, cancelled

  -- Timestamps
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  driver_arrived_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20), -- passenger, driver, system

  -- Pricing
  base_fare DECIMAL(10,2),
  distance_fare DECIMAL(10,2),
  time_fare DECIMAL(10,2),
  surge_multiplier DECIMAL(3,2) DEFAULT 1.0,
  fare_amount DECIMAL(10,2),
  tip_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2),
  promo_code VARCHAR(50),
  discount_amount DECIMAL(10,2) DEFAULT 0,

  -- Payment
  payment_method VARCHAR(50), -- card, cash, wallet
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, refunded
  payment_intent_id VARCHAR(100),
  refund_id VARCHAR(100),
  paid_at TIMESTAMP,
  refunded_at TIMESTAMP,
  payment_error TEXT,

  -- Ratings
  passenger_rating INT,
  driver_rating INT,
  passenger_review TEXT,
  driver_review TEXT,
  rated_at TIMESTAMP,

  -- Notes
  passenger_notes TEXT,
  driver_notes TEXT
);

CREATE INDEX idx_rides_passenger ON rides(passenger_id);
CREATE INDEX idx_rides_driver ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_requested_at ON rides(requested_at);
CREATE INDEX idx_rides_payment_status ON rides(payment_status);
```

### 4.4 Geospatial Queries

**Enable PostGIS Extension:**

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Find nearby drivers (within radius):**

```sql
-- Find drivers within 5km
SELECT
  id,
  name,
  vehicle_type,
  ST_Distance(
    current_location,
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography
  ) / 1000 AS distance_km
FROM drivers
WHERE status = 'online'
  AND ST_DWithin(
    current_location,
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
    5000 -- 5km radius in meters
  )
ORDER BY distance_km
LIMIT 10;
```

**Update driver location:**

```sql
UPDATE drivers
SET
  current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
  last_location_update = NOW()
WHERE id = $3;
```

**Calculate distance between two points:**

```sql
SELECT ST_Distance(
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
  ST_SetSRID(ST_MakePoint(-122.4312, 37.7849), 4326)::geography
) / 1000 AS distance_km;
```

### 4.5 Transactions Table

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES drivers(id),
  ride_id UUID REFERENCES rides(id),

  type VARCHAR(50) NOT NULL, -- ride_payment, tip, refund, payout, commission
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CAD',

  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50), -- stripe, paypal, cash
  gateway_transaction_id VARCHAR(100),

  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, cancelled

  description TEXT,
  metadata JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,

  CONSTRAINT check_amount CHECK (amount >= 0)
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_driver ON transactions(driver_id);
CREATE INDEX idx_transactions_ride ON transactions(ride_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);
```

### 4.6 Ratings Table

```sql
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  ride_id UUID REFERENCES rides(id) UNIQUE,

  -- Passenger rating driver
  driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
  driver_review TEXT,
  rated_by_passenger_at TIMESTAMP,

  -- Driver rating passenger
  passenger_rating INT CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
  passenger_review TEXT,
  rated_by_driver_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ratings_ride ON ratings(ride_id);
```

**Calculate average rating:**

```sql
-- Update driver average rating
UPDATE drivers
SET average_rating = (
  SELECT COALESCE(AVG(driver_rating), 5.0)
  FROM ratings r
  JOIN rides ri ON r.ride_id = ri.id
  WHERE ri.driver_id = drivers.id
    AND r.driver_rating IS NOT NULL
)
WHERE id = $1;

-- Update passenger average rating
UPDATE users
SET average_rating = (
  SELECT COALESCE(AVG(passenger_rating), 5.0)
  FROM ratings r
  JOIN rides ri ON r.ride_id = ri.id
  WHERE ri.passenger_id = users.id
    AND r.passenger_rating IS NOT NULL
)
WHERE id = $1;
```

### 4.7 Additional Tables

**Payment Methods:**

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),

  type VARCHAR(50), -- card, apple_pay, google_pay
  stripe_payment_method_id VARCHAR(100),

  card_brand VARCHAR(50), -- visa, mastercard, amex
  card_last4 VARCHAR(4),
  card_exp_month INT,
  card_exp_year INT,

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
```

**Promo Codes:**

```sql
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,

  discount_type VARCHAR(20), -- percentage, fixed
  discount_value DECIMAL(10,2),
  max_discount DECIMAL(10,2),

  min_fare_required DECIMAL(10,2),

  usage_limit INT,
  usage_count INT DEFAULT 0,

  valid_from TIMESTAMP,
  valid_until TIMESTAMP,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
```

**Notifications:**

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES drivers(id),

  type VARCHAR(50), -- ride_request, ride_accepted, driver_arrived, payment_failed, etc.
  title VARCHAR(255),
  body TEXT,
  data JSONB,

  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_driver ON notifications(driver_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

---

## 5. TESTING & DEPLOYMENT

### 5.1 Real-Time Testing Procedures

**Unit Tests:**

```javascript
// Test WebSocket connection
describe('WebSocket Location Service', () => {
  let server, socket, client;

  beforeEach((done) => {
    server = createServer();
    client = io.connect(`http://localhost:3000`, {
      transports: ['websocket']
    });

    client.on('connect', done);
  });

  afterEach(() => {
    client.disconnect();
    server.close();
  });

  test('Driver location update broadcasts to passenger', (done) => {
    const driverId = 'driver-123';
    const passengerId = 'passenger-456';

    // Passenger subscribes to driver
    client.emit('subscribe_driver', driverId);

    // Listen for location update
    client.on('driver_location', (data) => {
      expect(data.driverId).toBe(driverId);
      expect(data.latitude).toBeDefined();
      expect(data.longitude).toBeDefined();
      done();
    });

    // Simulate driver location update
    setTimeout(() => {
      client.emit('location_update', {
        driverId,
        latitude: 37.7749,
        longitude: -122.4194,
        heading: 90,
        speed: 30
      });
    }, 100);
  });

  test('Location update latency is under 2 seconds', (done) => {
    const startTime = Date.now();

    client.on('driver_location', () => {
      const latency = Date.now() - startTime;
      expect(latency).toBeLessThan(2000);
      done();
    });

    client.emit('location_update', {
      latitude: 37.7749,
      longitude: -122.4194
    });
  });
});
```

**Integration Tests:**

```javascript
// Test ride flow end-to-end
describe('Complete Ride Flow', () => {
  let passenger, driver;

  beforeAll(async () => {
    passenger = await createTestUser('passenger');
    driver = await createTestDriver('online');
  });

  test('Complete ride from request to payment', async () => {
    // 1. Passenger requests ride
    const ride = await request(app)
      .post('/api/rides')
      .send({
        passengerId: passenger.id,
        pickupLocation: { lat: 37.7749, lng: -122.4194 },
        dropoffLocation: { lat: 37.7849, lng: -122.4094 },
        vehicleType: 'economy'
      })
      .expect(201);

    expect(ride.body.status).toBe('requested');

    // 2. Driver accepts ride
    await request(app)
      .post(`/api/rides/${ride.body.id}/accept`)
      .send({ driverId: driver.id })
      .expect(200);

    // 3. Driver arrives
    await request(app)
      .post(`/api/rides/${ride.body.id}/arrived`)
      .expect(200);

    // 4. Start ride
    await request(app)
      .post(`/api/rides/${ride.body.id}/start`)
      .expect(200);

    // 5. Complete ride
    const completed = await request(app)
      .post(`/api/rides/${ride.body.id}/complete`)
      .send({
        distanceKm: 5.2,
        durationMinutes: 15
      })
      .expect(200);

    expect(completed.body.status).toBe('completed');
    expect(completed.body.fareAmount).toBeGreaterThan(0);

    // 6. Verify payment processed
    const updatedRide = await getRide(ride.body.id);
    expect(updatedRide.paymentStatus).toBe('paid');
  });
});
```

**Load Testing:**

```javascript
// Using Artillery for load testing
// artillery.yml
config:
  target: 'https://api.taxiapp.com'
  phases:
    - duration: 60
      arrivalRate: 10 # 10 new connections per second
      name: "Warm up"
    - duration: 120
      arrivalRate: 50 # 50 new connections per second
      name: "Sustained load"
  socketio:
    transports: ['websocket']

scenarios:
  - name: "Driver location updates"
    engine: socketio
    flow:
      - emit:
          channel: "authenticate"
          data:
            token: "{{ $randomString() }}"
      - think: 1
      - emit:
          channel: "location_update"
          data:
            latitude: 37.7749
            longitude: -122.4194
            heading: 90
            speed: 30
      - think: 2
      - loop:
        - emit:
            channel: "location_update"
            data:
              latitude: "{{ $randomNumber(37, 38) }}"
              longitude: "{{ $randomNumber(-123, -122) }}"
        count: 30
```

**Manual Testing Checklist:**

- [ ] Test on iOS device with real GPS
- [ ] Test on Android device with real GPS
- [ ] Test location accuracy in urban areas
- [ ] Test location accuracy in rural areas
- [ ] Test background location tracking
- [ ] Test with phone locked for 30+ minutes
- [ ] Test battery consumption over 8-hour period
- [ ] Test with poor network (3G)
- [ ] Test with intermittent network
- [ ] Test complete offline and reconnection
- [ ] Test multiple simultaneous rides (100+)
- [ ] Test location update frequency (verify 1-2s)
- [ ] Test map smoothness (no jittering)

### 5.2 Payment Testing

**Stripe Test Cards:**

```
Success:
- 4242 4242 4242 4242 (Visa)
- 5555 5555 5555 4444 (Mastercard)

3D Secure Required:
- 4000 0027 6000 3184

Declined:
- 4000 0000 0000 0002 (Generic decline)
- 4000 0000 0000 9995 (Insufficient funds)

Expired Card:
- 4000 0000 0000 0069

Incorrect CVC:
- 4000 0000 0000 0127
```

**Payment Test Scenarios:**

```javascript
describe('Payment Processing', () => {

  test('Successful payment with valid card', async () => {
    const ride = await createTestRide();
    const result = await processRidePayment(ride.id);

    expect(result.success).toBe(true);
    expect(result.paymentIntent.status).toBe('succeeded');

    const updatedRide = await getRide(ride.id);
    expect(updatedRide.paymentStatus).toBe('paid');
  });

  test('Payment fails with insufficient funds', async () => {
    const ride = await createTestRide();
    const user = await getUser(ride.passengerId);

    // Add test card with insufficient funds
    await addPaymentMethod(user.id, 'pm_card_chargeDeclinedInsufficientFunds');

    const result = await processRidePayment(ride.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('insufficient');

    const updatedRide = await getRide(ride.id);
    expect(updatedRide.paymentStatus).toBe('failed');
  });

  test('3D Secure authentication required', async () => {
    const ride = await createTestRide();
    const user = await getUser(ride.passengerId);

    // Add test card requiring 3DS
    await addPaymentMethod(user.id, 'pm_card_authenticationRequired');

    const result = await processRidePayment(ride.id);

    // Should require additional authentication
    expect(result.requiresAction).toBe(true);
    expect(result.clientSecret).toBeDefined();
  });

  test('Refund processes correctly', async () => {
    const ride = await createCompletedRide();

    const refund = await refundRide(ride.id, 'requested_by_customer');

    expect(refund.success).toBe(true);

    const updatedRide = await getRide(ride.id);
    expect(updatedRide.paymentStatus).toBe('refunded');
  });

  test('Tip added after ride completion', async () => {
    const ride = await createCompletedRide();
    const originalAmount = ride.totalAmount;

    const result = await addTip(ride.id, 5.00);

    expect(result.success).toBe(true);

    const updatedRide = await getRide(ride.id);
    expect(updatedRide.tipAmount).toBe(5.00);
    expect(updatedRide.totalAmount).toBe(originalAmount + 5.00);
  });
});
```

**Manual Payment Testing:**

- [ ] Add credit card (Visa, Mastercard, Amex)
- [ ] Add Apple Pay (iOS)
- [ ] Add Google Pay (Android)
- [ ] Set default payment method
- [ ] Process ride payment automatically
- [ ] Process payment with 3D Secure
- [ ] Handle declined payment
- [ ] Handle insufficient funds
- [ ] Add tip after ride
- [ ] Request refund
- [ ] Verify receipt generation
- [ ] Verify receipt email delivery
- [ ] Test cash payment option
- [ ] Test payment method deletion
- [ ] Verify no card data stored locally

### 5.3 App Store Submission Checklist

**Pre-Submission Requirements:**

**Apple App Store (iOS):**

- [ ] Apple Developer Account ($99/year)
- [ ] App signed with distribution certificate
- [ ] App Store Connect app record created
- [ ] App icons (1024x1024 PNG)
- [ ] Screenshots (all required device sizes)
- [ ] App privacy policy URL
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Age rating questionnaire completed
- [ ] App Store description (170 chars subtitle, 4000 chars description)
- [ ] Keywords (100 characters, comma-separated)
- [ ] App Store category selected
- [ ] In-app purchases configured (if any)

**Google Play Store (Android):**

- [ ] Google Play Developer Account ($25 one-time)
- [ ] App signed with release keystore
- [ ] Google Play Console app created
- [ ] App icons (512x512 PNG)
- [ ] Screenshots (phone, tablet, 7-inch tablet)
- [ ] Feature graphic (1024x500 PNG)
- [ ] Privacy policy URL
- [ ] App description (80 chars short, 4000 chars full)
- [ ] App category selected
- [ ] Content rating questionnaire completed
- [ ] Target audience and content rating
- [ ] Data safety form completed

**Technical Requirements:**

**iOS:**

- [ ] Xcode latest stable version
- [ ] iOS minimum version: 13.0+
- [ ] Supports iPhone and iPad
- [ ] App launch time <5 seconds
- [ ] No crashes during review
- [ ] Dark mode support (recommended)
- [ ] Works on all screen sizes
- [ ] Localization (if applicable)
- [ ] Background modes declared (location)
- [ ] Camera/photo library permissions explained
- [ ] Location permission explained
- [ ] Push notification permission explained

**Android:**

- [ ] Android Studio latest stable version
- [ ] Minimum SDK: 21 (Android 5.0)
- [ ] Target SDK: 34 (Android 14)
- [ ] Signed APK or AAB
- [ ] Permissions declared in manifest
- [ ] Location permission runtime request
- [ ] Background location permission (API 29+)
- [ ] Foreground service notification
- [ ] ProGuard rules configured
- [ ] App size optimized (<150MB)

**Privacy & Legal:**

- [ ] Privacy policy covers:
  - [ ] Location data collection
  - [ ] Payment information handling
  - [ ] User data retention
  - [ ] Third-party services (Stripe, Google Maps)
  - [ ] Data deletion process
- [ ] Terms of service
- [ ] GDPR compliance (if applicable)
- [ ] CCPA compliance (if applicable)
- [ ] Age requirements (18+ for drivers)
- [ ] Background location disclosure

**App Review Guidelines Compliance:**

**iOS App Store:**

- [ ] No crashes or bugs
- [ ] Complete app (no placeholders)
- [ ] Test account provided (if login required)
- [ ] No spam or copycat apps
- [ ] In-app purchases correctly implemented
- [ ] No hidden features
- [ ] Accurate app description
- [ ] Location usage clearly explained
- [ ] Payment processing via approved gateway

**Google Play Store:**

- [ ] Complies with content policies
- [ ] No misleading claims
- [ ] Accurate app categorization
- [ ] Correct maturity rating
- [ ] No policy violations
- [ ] Malware-free
- [ ] No ads or misleading content
- [ ] Declares all permissions accurately

**Quality Assurance:**

- [ ] Tested on multiple devices
- [ ] Tested on multiple OS versions
- [ ] No memory leaks
- [ ] Proper error handling
- [ ] Graceful offline mode
- [ ] Battery usage optimized
- [ ] Network usage optimized
- [ ] Smooth animations (60fps)
- [ ] Accessibility features (VoiceOver, TalkBack)
- [ ] Beta testing completed
- [ ] User feedback addressed

**App Metadata:**

**App Store:**
```
App Name: [Your Taxi App]
Subtitle: Reliable rides at your fingertips
Description:
Book safe, reliable rides in seconds. Track your driver in real-time,
pay seamlessly, and arrive at your destination with ease.

Features:
• Real-time driver tracking
• Multiple payment options
• Ride history and receipts
• Driver ratings
• Safe and reliable
• 24/7 availability

Keywords: taxi, ride, uber, lyft, transportation, cab, driver
Category: Navigation / Travel
Age Rating: 4+
```

**Play Store:**
```
App Name: [Your Taxi App]
Short Description: Reliable rides in seconds
Full Description:
[Similar to App Store, 4000 character limit]

Category: Maps & Navigation
Content Rating: Everyone
Tags: taxi, ride-hailing, transportation
```

**Test Flight / Internal Testing:**

- [ ] Upload beta build
- [ ] Add internal testers
- [ ] Run beta for 1-2 weeks
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Upload release candidate

**Submission Process:**

1. **Final Build:**
   - Increment version number
   - Archive app (Xcode) or Generate signed bundle (Android Studio)
   - Test archived build on device

2. **Upload:**
   - iOS: Upload via Xcode or Transporter
   - Android: Upload AAB to Play Console

3. **Complete Metadata:**
   - Fill all required fields
   - Upload screenshots
   - Write compelling description
   - Add privacy policy link

4. **Submit for Review:**
   - iOS: Submit via App Store Connect
   - Android: Submit via Play Console

5. **Review Timeline:**
   - iOS: 1-3 days typically
   - Android: Few hours to 7 days

6. **Handle Rejections:**
   - Read rejection reason carefully
   - Fix issues
   - Respond to reviewer if needed
   - Resubmit

**Post-Launch:**

- [ ] Monitor crash reports
- [ ] Monitor reviews and ratings
- [ ] Respond to user feedback
- [ ] Track download metrics
- [ ] Plan feature updates
- [ ] Regular maintenance updates

---

## 6. PERFORMANCE BENCHMARKS

### 6.1 Response Time Requirements

| Endpoint/Feature | Target Response Time | Maximum Acceptable |
|------------------|---------------------|-------------------|
| User login | <500ms | 1s |
| Ride request | <1s | 2s |
| Driver matching | <10s | 30s |
| Location update (driver to passenger) | <2s | 3s |
| Payment processing | <5s | 10s |
| Fare calculation | <500ms | 1s |
| Map loading | <2s | 3s |
| Ride history fetch | <2s | 3s |

### 6.2 Scalability Requirements

| Metric | Minimum | Target | Stress Test |
|--------|---------|--------|-------------|
| Concurrent active rides | 100 | 500 | 1000 |
| Online drivers | 100 | 500 | 1000 |
| Location updates/second | 500 | 2500 | 5000 |
| API requests/second | 1000 | 5000 | 10000 |
| Database connections | 50 | 100 | 200 |
| WebSocket connections | 500 | 2000 | 5000 |

### 6.3 Reliability Requirements

| Metric | Target |
|--------|--------|
| System uptime | 99.5%+ |
| API availability | 99.9%+ |
| Payment success rate | 99%+ |
| Location accuracy | 95%+ within 10m |
| App crash rate | <1% |
| Payment failure rate | <1% |

---

## 7. SECURITY REQUIREMENTS

### 7.1 Authentication & Authorization

**Requirements:**
- JWT-based authentication
- Password hashing with bcrypt (cost factor 12+)
- Session expiration (7 days for mobile)
- Refresh token mechanism
- Rate limiting on login attempts (5 attempts/15 min)
- Password requirements (8+ chars, uppercase, number, special char)
- Two-factor authentication (optional, future)

### 7.2 Data Protection

**Requirements:**
- TLS 1.2+ for all API communication
- Database encryption at rest
- No plaintext passwords stored
- PCI-DSS compliance via Stripe (no card data stored)
- Secure API key storage (environment variables, secrets manager)
- No sensitive data in logs
- GDPR right to deletion
- Data retention policy (2 years for rides)

### 7.3 API Security

**Requirements:**
- API key/token authentication
- Rate limiting per user (1000 requests/hour)
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention
- CSRF protection
- CORS properly configured
- Webhook signature verification
- IP whitelisting for admin endpoints

### 7.4 Mobile App Security

**Requirements:**
- Certificate pinning
- ProGuard/R8 code obfuscation (Android)
- Jailbreak/root detection
- Secure storage for tokens (Keychain/Keystore)
- No hardcoded secrets in source code
- Binary protection
- Deep link validation

### 7.5 Background Checks (Driver Verification)

**Requirements:**
- Government-issued ID verification
- Driver's license verification
- Vehicle registration verification
- Insurance verification
- Criminal background check (optional, via third-party)
- Driving record check (optional)
- Manual admin approval process

---

## 8. MAINTENANCE & SUPPORT

### 8.1 Post-Launch Monitoring

**Tools:**
- Application monitoring: Sentry, New Relic, or Datadog
- Server monitoring: CloudWatch, Grafana, or Prometheus
- Log aggregation: ELK Stack or CloudWatch Logs
- Uptime monitoring: Pingdom or UptimeRobot

**Metrics to Monitor:**
- API response times
- Error rates
- WebSocket connection stability
- Database query performance
- Payment success/failure rates
- Active user count
- Crash reports

### 8.2 Backup & Disaster Recovery

**Requirements:**
- Daily database backups (automated)
- Backup retention: 30 days
- Point-in-time recovery capability
- Disaster recovery plan documented
- Backup restoration tested quarterly
- Multi-region redundancy (optional)

### 8.3 Updates & Maintenance

**Planned Activities:**
- Weekly dependency updates
- Monthly security patches
- Quarterly feature releases
- Annual major version updates

### 8.4 Support Structure

**Levels:**
- Tier 1: Customer support (in-app chat, email)
- Tier 2: Technical support (driver verification, payment issues)
- Tier 3: Development team (critical bugs, system issues)

**Response Times:**
- Critical (system down): <1 hour
- High (payment failure): <4 hours
- Medium (feature bug): <24 hours
- Low (enhancement request): <7 days

---

## 9. DOCUMENTATION DELIVERABLES

### 9.1 Technical Documentation

**Required Documents:**

1. **System Architecture Document**
   - High-level architecture diagram
   - Component descriptions
   - Technology stack details
   - Data flow diagrams
   - Security architecture

2. **API Documentation**
   - REST API reference (Swagger/OpenAPI)
   - WebSocket event documentation
   - Authentication flow
   - Request/response examples
   - Error codes and handling

3. **Database Documentation**
   - Schema diagrams (ERD)
   - Table descriptions
   - Index strategies
   - Query examples
   - Backup/restore procedures

4. **Deployment Guide**
   - Environment setup
   - Configuration management
   - CI/CD pipeline setup
   - Cloud infrastructure setup (AWS/GCP/Azure)
   - Secrets management
   - SSL certificate setup
   - Domain configuration

5. **Integration Guides**
   - Stripe payment integration
   - Google Maps integration
   - Push notification setup (FCM/APNS)
   - Third-party services

### 9.2 User Documentation

1. **Passenger User Guide**
   - How to create account
   - How to book a ride
   - How to add payment method
   - How to track driver
   - How to rate driver
   - How to view ride history
   - FAQ

2. **Driver User Guide**
   - How to register as driver
   - How to get verified
   - How to accept rides
   - How to navigate to pickup
   - How to complete trips
   - How to view earnings
   - How to go online/offline
   - FAQ

3. **Admin User Guide**
   - Dashboard overview
   - How to approve drivers
   - How to monitor rides
   - How to manage users
   - How to configure pricing
   - How to generate reports
   - How to handle disputes

### 9.3 Developer Documentation

1. **Setup Instructions**
   - Local development environment
   - Install dependencies
   - Database setup
   - Environment variables
   - Running the app

2. **Code Style Guide**
   - Naming conventions
   - Code formatting
   - Best practices
   - Git workflow

3. **Testing Guide**
   - Unit test examples
   - Integration test examples
   - E2E test setup
   - Test coverage requirements

---

## 10. SUCCESS CRITERIA SUMMARY

### 10.1 Acceptance Criteria (Must-Have)

- **Real-Time Tracking:** <2 second location update latency ✅
- **Payment Processing:** Successful end-to-end test payment ✅
- **Driver Ratings:** Instant rating display ✅
- **Cross-Platform:** Working on both iOS and Android ✅
- **API Performance:** <500ms average response time ✅
- **System Uptime:** 99.5%+ availability ✅

### 10.2 Business Goals

- Launch-ready apps in 9 weeks
- Support 100+ concurrent rides at launch
- Zero critical security vulnerabilities
- App Store approval on first submission
- Complete admin dashboard for operations
- Comprehensive documentation for handoff

### 10.3 User Experience Goals

- Intuitive UI requiring minimal training
- Ride booking in <30 seconds
- Driver match in <30 seconds
- Smooth real-time tracking experience
- Simple payment with no friction
- Average app rating >4.5 stars

---

## APPENDIX

### A. Technology Recommendations Summary

| Component | Recommended | Alternative |
|-----------|-------------|-------------|
| Mobile Framework | React Native | Flutter, Native |
| Backend | Node.js + Express | Python + FastAPI |
| Database | PostgreSQL + PostGIS | MongoDB + Redis |
| Real-Time | Socket.io + Redis | Firebase Realtime DB |
| Payments | Stripe | PayPal, Square |
| Maps | Google Maps | Mapbox |
| Hosting | AWS | Google Cloud, Azure |
| Push Notifications | FCM/APNS | OneSignal |

### B. Cost Estimates

**Development Costs:** CA $6,700 - $10,600

**Monthly Operating Costs:**
- Cloud hosting: $100-500
- Google Maps API: $50-200
- Payment processing: 2.9% + $0.30/transaction
- Push notifications: $0-50
- SMS (if used): $0.01-0.05/SMS
- Total: ~$200-800/month (excluding transaction fees)

**Annual Costs:**
- Apple Developer Account: $99
- Google Play Developer: $25 (one-time)
- Domain & SSL: $50-100
- Maintenance & Support: $6,000-18,000

### C. Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| App Store rejection | High | Medium | Follow guidelines strictly, beta test |
| Payment issues | High | Low | Use Stripe, comprehensive testing |
| Real-time latency | High | Medium | Redis pub/sub, WebSocket optimization |
| Battery drain | Medium | Medium | Adaptive location updates, background optimization |
| Driver shortage | High | High | Driver incentives, competitive rates |
| Security breach | High | Low | Security audits, best practices |
| Scalability issues | Medium | Medium | Cloud auto-scaling, load testing |

### D. Timeline Phases

**Phase 1 - Foundation (Weeks 1-2):**
- Requirements finalization
- UI/UX design
- Database schema
- Architecture planning

**Phase 2 - Backend (Weeks 3-4):**
- API development
- Real-time service
- Payment integration
- Authentication

**Phase 3 - Mobile Apps (Weeks 5-6):**
- Passenger app
- Driver app
- Real-time tracking
- Payment UI
- Push notifications

**Phase 4 - Admin & Testing (Weeks 7-8):**
- Admin dashboard
- Integration testing
- Payment testing
- Performance testing
- Security testing

**Phase 5 - Launch (Week 9):**
- App store submissions
- Production deployment
- Documentation
- Training
- Go-live

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Prepared for:** Taxi Booking App Development Project
**Budget:** CA $5,000 – $10,000
**Timeline:** 9 weeks

# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### Register User (Passenger)
**POST** `/auth/register/user`

Register a new passenger account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "phone": "+12345678900",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+12345678900",
    "name": "John Doe",
    "created_at": "2025-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Register Driver
**POST** `/auth/register/driver`

Register a new driver account.

**Request Body:**
```json
{
  "email": "driver@example.com",
  "phone": "+12345678901",
  "password": "securepassword123",
  "name": "Jane Smith",
  "vehicleType": "economy",
  "vehicleMake": "Toyota",
  "vehicleModel": "Camry",
  "vehicleYear": 2020,
  "vehicleColor": "Silver",
  "vehiclePlate": "ABC123",
  "licenseNumber": "D1234567",
  "licenseExpiry": "2026-12-31"
}
```

### Login User
**POST** `/auth/login/user`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "status": "active"
  },
  "token": "...",
  "refreshToken": "..."
}
```

### Login Driver
**POST** `/auth/login/driver`

### Login Admin
**POST** `/auth/login/admin`

### Refresh Token
**POST** `/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "..."
}
```

---

## Ride Endpoints

### Create Ride Request
**POST** `/rides`

Request a new ride.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "pickupLatitude": 37.7749,
  "pickupLongitude": -122.4194,
  "pickupAddress": "123 Main St, San Francisco, CA",
  "dropoffLatitude": 37.7849,
  "dropoffLongitude": -122.4094,
  "dropoffAddress": "456 Market St, San Francisco, CA",
  "vehicleType": "economy",
  "paymentMethod": "card",
  "passengerNotes": "Please call when you arrive"
}
```

**Response:**
```json
{
  "id": "ride-uuid",
  "passenger_id": "user-uuid",
  "pickup_latitude": 37.7749,
  "pickup_longitude": -122.4194,
  "pickup_address": "123 Main St",
  "dropoff_latitude": 37.7849,
  "dropoff_longitude": -122.4094,
  "dropoff_address": "456 Market St",
  "vehicle_type": "economy",
  "status": "requested",
  "fare_amount": 15.50,
  "distance_km": 5.2,
  "duration_minutes": 15,
  "requested_at": "2025-01-01T00:00:00.000Z"
}
```

### Get Fare Estimate
**POST** `/rides/estimate`

Calculate fare before booking.

**Request Body:**
```json
{
  "pickupLatitude": 37.7749,
  "pickupLongitude": -122.4194,
  "dropoffLatitude": 37.7849,
  "dropoffLongitude": -122.4094,
  "vehicleType": "economy"
}
```

**Response:**
```json
{
  "baseFare": 3.50,
  "distanceFare": 7.80,
  "timeFare": 4.20,
  "estimatedDistance": 5.2,
  "estimatedDuration": 14,
  "subtotal": 15.50,
  "total": 15.50,
  "currency": "CAD"
}
```

### Get Ride Details
**GET** `/rides/:rideId`

### Get Ride History
**GET** `/rides/history/me?page=1&limit=20`

**Response:**
```json
{
  "rides": [
    {
      "id": "ride-uuid",
      "pickup_address": "123 Main St",
      "dropoff_address": "456 Market St",
      "fare_amount": 15.50,
      "status": "completed",
      "completed_at": "2025-01-01T00:30:00.000Z",
      "driver_name": "Jane Smith",
      "driver_rating": 4.8
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Accept Ride (Driver)
**POST** `/rides/:rideId/accept`

### Reject Ride (Driver)
**POST** `/rides/:rideId/reject`

### Cancel Ride
**POST** `/rides/:rideId/cancel`

**Request Body:**
```json
{
  "reason": "Changed plans"
}
```

### Rate Ride
**POST** `/rides/:rideId/rate`

**Request Body:**
```json
{
  "rating": 5,
  "review": "Excellent driver!"
}
```

### Add Tip
**POST** `/rides/:rideId/tip`

**Request Body:**
```json
{
  "amount": 5.00
}
```

### Get Active Ride
**GET** `/rides/active/current`

Returns the currently active ride for the authenticated user/driver.

---

## Payment Endpoints

### Add Payment Method
**POST** `/payments/methods`

**Request Body:**
```json
{
  "paymentMethodId": "pm_xxxxxxxxx"
}
```

### Get Payment Methods
**GET** `/payments/methods`

**Response:**
```json
[
  {
    "id": "uuid",
    "type": "card",
    "card_brand": "visa",
    "card_last4": "4242",
    "card_exp_month": 12,
    "card_exp_year": 2025,
    "is_default": true
  }
]
```

### Set Default Payment Method
**PUT** `/payments/methods/:paymentMethodId/default`

### Delete Payment Method
**DELETE** `/payments/methods/:paymentMethodId`

### Validate Promo Code
**POST** `/payments/promo/validate`

**Request Body:**
```json
{
  "code": "SAVE20",
  "fareAmount": 20.00
}
```

**Response:**
```json
{
  "code": "SAVE20",
  "discountAmount": 4.00,
  "finalAmount": 16.00
}
```

---

## Driver Endpoints

### Get Driver Profile
**GET** `/drivers/profile`

**Response:**
```json
{
  "id": "uuid",
  "email": "driver@example.com",
  "name": "Jane Smith",
  "phone": "+12345678901",
  "vehicle_type": "economy",
  "vehicle_make": "Toyota",
  "vehicle_model": "Camry",
  "vehicle_color": "Silver",
  "vehicle_plate": "ABC123",
  "average_rating": 4.85,
  "total_rides": 150,
  "acceptance_rate": 92.5,
  "status": "online",
  "verification_status": "approved",
  "total_earnings": 5250.00,
  "balance": 450.00
}
```

### Update Driver Profile
**PUT** `/drivers/profile`

**Request Body:**
```json
{
  "name": "Jane Doe",
  "phone": "+12345678902"
}
```

### Get Earnings Summary
**GET** `/drivers/earnings?period=week`

Parameters:
- `period`: today, week, month, all

**Response:**
```json
{
  "totalRides": 45,
  "totalFare": 850.00,
  "totalTips": 125.00,
  "commission": 20,
  "netEarnings": 805.00,
  "avgFare": 18.89
}
```

### Update Driver Status
**PUT** `/drivers/status`

**Request Body:**
```json
{
  "status": "online"
}
```

### Get Performance Metrics
**GET** `/drivers/metrics`

---

## User Endpoints

### Get User Profile
**GET** `/users/profile`

### Update User Profile
**PUT** `/users/profile`

### Get Favorite Locations
**GET** `/users/favorites`

### Add Favorite Location
**POST** `/users/favorites`

**Request Body:**
```json
{
  "label": "Home",
  "address": "123 Main St, San Francisco, CA",
  "latitude": 37.7749,
  "longitude": -122.4194
}
```

### Delete Favorite Location
**DELETE** `/users/favorites/:favoriteId`

---

## Admin Endpoints

### Get Dashboard Stats
**GET** `/admin/stats`

**Response:**
```json
{
  "totalUsers": 1523,
  "totalDrivers": 245,
  "onlineDrivers": 78,
  "activeRides": 12,
  "today": {
    "totalRides": 156,
    "totalRevenue": 3245.50,
    "avgFare": 20.81
  }
}
```

### List All Users
**GET** `/admin/users?page=1&limit=20&search=john`

### List All Drivers
**GET** `/admin/drivers?page=1&limit=20&status=pending&search=jane`

### Approve Driver
**POST** `/admin/drivers/:driverId/approve`

### Reject Driver
**POST** `/admin/drivers/:driverId/reject`

**Request Body:**
```json
{
  "reason": "Invalid license"
}
```

### List All Rides
**GET** `/admin/rides?page=1&limit=20&status=completed`

### Create Promo Code
**POST** `/admin/promo-codes`

**Request Body:**
```json
{
  "code": "SAVE20",
  "discountType": "percentage",
  "discountValue": 20,
  "maxDiscount": 10.00,
  "minFareRequired": 15.00,
  "usageLimit": 100,
  "validFrom": "2025-01-01T00:00:00Z",
  "validUntil": "2025-12-31T23:59:59Z"
}
```

### Get Revenue Report
**GET** `/admin/reports/revenue?startDate=2025-01-01&endDate=2025-01-31`

---

## WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  auth: { token: 'your-jwt-token' }
});
```

### Driver Events

#### Location Update
```javascript
socket.emit('location_update', {
  latitude: 37.7749,
  longitude: -122.4194,
  heading: 90,
  speed: 30
});
```

#### Go Online/Offline
```javascript
socket.emit('go_online');
socket.emit('go_offline');
```

#### Accept/Reject Ride
```javascript
socket.emit('accept_ride', { rideId: 'ride-uuid' });
socket.emit('reject_ride', { rideId: 'ride-uuid' });
```

#### Ride Status Updates
```javascript
socket.emit('arrived_at_pickup', { rideId: 'ride-uuid' });
socket.emit('start_ride', { rideId: 'ride-uuid' });
socket.emit('complete_ride', {
  rideId: 'ride-uuid',
  distanceKm: 5.2,
  durationMinutes: 15
});
```

### Passenger Events

#### Subscribe to Driver Location
```javascript
socket.emit('subscribe_driver', driverId);
```

#### Receive Location Updates
```javascript
socket.on('driver_location', (data) => {
  console.log('Driver at:', data.latitude, data.longitude);
  console.log('ETA:', data.eta);
});
```

#### Ride Status Updates
```javascript
socket.on('ride_accepted', (data) => {
  console.log('Driver accepted:', data.driver);
});

socket.on('driver_arrived', (data) => {
  console.log('Driver has arrived');
});

socket.on('ride_started', (data) => {
  console.log('Ride started');
});

socket.on('ride_completed', (data) => {
  console.log('Ride completed. Fare:', data.fareAmount);
});
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Rate Limiting

API endpoints are rate limited to:
- **100 requests per 15 minutes** per IP address

When rate limit is exceeded, the API returns:
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```
Status code: `429 Too Many Requests`

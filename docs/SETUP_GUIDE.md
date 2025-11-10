# Project Setup Guide

## Quick Start

This guide will help you set up the complete taxi booking application on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ with PostGIS extension ([Download](https://www.postgresql.org/download/))
- **Redis** ([Download](https://redis.io/download/))
- **Git** ([Download](https://git-scm.com/downloads))
- **Expo CLI** (for mobile development): `npm install -g expo-cli`

### Additional Requirements

- Google Maps API key ([Get one here](https://developers.google.com/maps/documentation/javascript/get-api-key))
- Stripe account ([Sign up](https://stripe.com/))
- Firebase project for push notifications ([Create project](https://firebase.google.com/))

---

## Project Structure Overview

```
04-taxi-booking-app/
├── backend/          # Node.js/Express API server
├── apps/
│   ├── passenger/   # React Native passenger app
│   └── driver/      # React Native driver app
├── admin/           # React admin dashboard
└── docs/            # Documentation
```

---

## Step 1: Clone Repository

```bash
git clone <repository-url>
cd 04-taxi-booking-app
```

---

## Step 2: Backend Setup

### 2.1 Install Dependencies

```bash
cd backend
npm install
```

### 2.2 Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and update the following values:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxi_booking
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets (generate random strings)
JWT_SECRET=your_jwt_secret_key_change_this
JWT_REFRESH_SECRET=your_refresh_secret_key_change_this

# Stripe Keys (from Stripe dashboard)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_key

# Firebase (optional for push notifications)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 2.3 Setup PostgreSQL Database

#### On macOS:

```bash
# Start PostgreSQL
brew services start postgresql@14

# Create database
createdb taxi_booking

# Enable PostGIS
psql taxi_booking -c "CREATE EXTENSION postgis;"
```

#### On Ubuntu/Linux:

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Switch to postgres user
sudo -u postgres psql

# Create database and enable PostGIS
CREATE DATABASE taxi_booking;
\c taxi_booking
CREATE EXTENSION postgis;
\q
```

#### On Windows:

Use pgAdmin or psql command line to:
1. Create database named `taxi_booking`
2. Enable PostGIS extension

### 2.4 Run Database Migrations

```bash
npm run migrate
```

This will create all necessary tables with proper schema.

### 2.5 Start Redis

#### macOS:

```bash
brew services start redis
```

#### Ubuntu/Linux:

```bash
sudo systemctl start redis
```

#### Windows:

Download and install from [Redis website](https://redis.io/download/) or use WSL.

### 2.6 Start Backend Server

```bash
npm run dev
```

The backend will start on `http://localhost:3000`

You should see:
```
Server running on port 3000
Environment: development
Database connected successfully
Redis connected successfully
WebSocket server initialized
```

### 2.7 Verify Backend is Running

Open browser and navigate to:
```
http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 10.5
}
```

---

## Step 3: Passenger App Setup

### 3.1 Install Dependencies

```bash
cd ../apps/passenger
npm install
```

### 3.2 Configure API URL

Edit `src/services/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
// For physical device testing, use your computer's IP:
// const API_BASE_URL = 'http://192.168.1.100:3000/api';
```

### 3.3 Configure Google Maps

Edit `App.js` and add your Google Maps API key:

```javascript
<GooglePlacesAutocomplete
  query={{
    key: 'YOUR_GOOGLE_MAPS_API_KEY',
    language: 'en',
  }}
/>
```

Also update in `src/screens/HomeScreen.js`.

### 3.4 Configure Stripe

Edit `App.js`:

```javascript
<StripeProvider publishableKey="pk_test_YOUR_PUBLISHABLE_KEY">
```

### 3.5 Start Passenger App

```bash
npm start
```

This will start the Expo development server. You can then:

- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan QR code with Expo Go app on physical device

---

## Step 4: Driver App Setup

### 4.1 Install Dependencies

```bash
cd ../driver
npm install
```

### 4.2 Configure API URL

Same as passenger app, edit `src/services/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

### 4.3 Configure WebSocket URL

Edit `src/services/websocket.js`:

```javascript
const SOCKET_URL = 'http://localhost:3000';
```

### 4.4 Start Driver App

```bash
npm start
```

---

## Step 5: Admin Dashboard Setup

### 5.1 Install Dependencies

```bash
cd ../../admin
npm install
```

### 5.2 Configure API URL

Edit `src/services/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

### 5.3 Start Dashboard

```bash
npm start
```

The dashboard will open at `http://localhost:3000`

---

## Step 6: Create Test Accounts

### 6.1 Create Admin Account

Using a REST client (Postman, curl, etc.):

```bash
curl -X POST http://localhost:3000/api/admin/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123",
    "name": "Admin User"
  }'
```

### 6.2 Create Test Passenger

Using the passenger app, register a new account, or use API:

```bash
curl -X POST http://localhost:3000/api/auth/register/user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "passenger@example.com",
    "phone": "+12345678900",
    "password": "password123",
    "name": "Test Passenger"
  }'
```

### 6.3 Create Test Driver

Using the driver app or API:

```bash
curl -X POST http://localhost:3000/api/auth/register/driver \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "phone": "+12345678901",
    "password": "password123",
    "name": "Test Driver",
    "vehicleType": "economy",
    "vehicleMake": "Toyota",
    "vehicleModel": "Camry",
    "vehicleYear": 2020,
    "vehicleColor": "Silver",
    "vehiclePlate": "ABC123",
    "licenseNumber": "D1234567",
    "licenseExpiry": "2026-12-31"
  }'
```

### 6.4 Approve Test Driver

1. Login to admin dashboard with admin credentials
2. Navigate to "Drivers" section
3. Find the test driver
4. Click "Approve"

---

## Step 7: Test the Application

### 7.1 Test Basic Flow

1. **Passenger App:**
   - Login with passenger credentials
   - Set pickup and destination locations
   - Request a ride
   - See fare estimate

2. **Driver App:**
   - Login with driver credentials
   - Go online
   - Accept the ride request
   - Navigate to pickup location
   - Complete the ride

3. **Admin Dashboard:**
   - View dashboard statistics
   - Monitor active rides
   - View ride history

### 7.2 Test Payment Flow

1. Use Stripe test card: `4242 4242 4242 4242`
2. Any future expiry date
3. Any 3-digit CVC

---

## Troubleshooting

### Backend Issues

**Database connection failed:**
```bash
# Check PostgreSQL is running
# macOS: brew services list
# Linux: sudo systemctl status postgresql
# Windows: Check services.msc

# Test connection
psql -U postgres -d taxi_booking -h localhost
```

**Redis connection failed:**
```bash
# Check Redis is running
# macOS: brew services list
# Linux: sudo systemctl status redis

# Test connection
redis-cli ping
# Should return PONG
```

### Mobile App Issues

**Cannot connect to API:**
- If using physical device, update API_BASE_URL to use your computer's IP address
- Ensure your phone and computer are on the same network
- Check firewall settings

**Google Maps not showing:**
- Verify Google Maps API key is correct
- Enable required APIs in Google Cloud Console:
  - Maps SDK for iOS
  - Maps SDK for Android
  - Places API
  - Directions API

**Location permission denied:**
- Grant location permissions in phone settings
- For iOS simulator: Features → Location → Custom Location

### Admin Dashboard Issues

**Cannot login:**
- Verify admin account was created successfully
- Check backend logs for errors
- Clear browser cache and cookies

---

## Development Tips

### Hot Reloading

- Backend: Using `nodemon`, changes auto-reload
- Mobile apps: Shake device or press `r` in terminal
- Admin dashboard: Auto-reloads on save

### Debugging

**Backend:**
```bash
# View logs
npm run dev

# View PM2 logs (if using PM2)
pm2 logs taxi-backend
```

**Mobile Apps:**
```bash
# View React Native logs
npx react-native log-ios
npx react-native log-android

# View Expo logs
# Already shown in terminal where you ran npm start
```

**Database:**
```bash
# Connect to database
psql -U postgres -d taxi_booking

# View all users
SELECT * FROM users;

# View all rides
SELECT * FROM rides;
```

### Testing APIs

Use Postman, Insomnia, or curl to test API endpoints.

Example: Get user profile
```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Next Steps

1. **Customize**: Update branding, colors, and app name
2. **Configure**: Set up production API keys
3. **Test**: Thoroughly test all features
4. **Deploy**: Follow [Deployment Guide](DEPLOYMENT_GUIDE.md)
5. **Monitor**: Set up monitoring and error tracking

---

## Additional Resources

- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Database Schema](../backend/src/database/schema.sql)
- [Requirements Document](../REQUIREMENTS.md)

---

## Support

If you encounter issues:

1. Check troubleshooting section above
2. Review logs for error messages
3. Verify all prerequisites are installed
4. Check API documentation for correct endpoint usage

---

## Security Notes

**Important for Production:**

1. Change all default passwords
2. Use strong JWT secrets
3. Enable SSL/TLS
4. Use production Stripe keys
5. Restrict API keys by domain/IP
6. Enable rate limiting
7. Regular security audits

---

## Summary

You should now have:
- ✅ Backend API running on port 3000
- ✅ PostgreSQL database with schema
- ✅ Redis cache running
- ✅ Passenger app running
- ✅ Driver app running
- ✅ Admin dashboard running
- ✅ Test accounts created

Ready to start developing!

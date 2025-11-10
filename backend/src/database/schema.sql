-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Passengers)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  profile_photo_url VARCHAR(500),
  stripe_customer_id VARCHAR(100),
  average_rating DECIMAL(3,2) DEFAULT 5.0,
  total_rides INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);

-- Drivers Table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  profile_photo_url VARCHAR(500),

  -- Vehicle information
  vehicle_type VARCHAR(50),
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
  background_check_status VARCHAR(20),
  verification_status VARCHAR(20) DEFAULT 'pending',

  -- Performance metrics
  average_rating DECIMAL(3,2) DEFAULT 5.0,
  total_rides INT DEFAULT 0,
  acceptance_rate DECIMAL(5,2) DEFAULT 100.0,
  cancellation_rate DECIMAL(5,2) DEFAULT 0.0,

  -- Status
  status VARCHAR(20) DEFAULT 'offline',
  current_location GEOGRAPHY(POINT, 4326),
  last_location_update TIMESTAMP,

  -- Earnings
  total_earnings DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_verification ON drivers(verification_status);
CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location);
CREATE INDEX idx_drivers_email ON drivers(email);
CREATE INDEX idx_drivers_phone ON drivers(phone);

-- Rides Table
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

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

  -- Timestamps
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  driver_arrived_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20),

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
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending',
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

-- Transactions Table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES drivers(id),
  ride_id UUID REFERENCES rides(id),

  type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CAD',

  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50),
  gateway_transaction_id VARCHAR(100),

  status VARCHAR(20) DEFAULT 'pending',

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

-- Payment Methods Table
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),

  type VARCHAR(50),
  stripe_payment_method_id VARCHAR(100),

  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  card_exp_month INT,
  card_exp_year INT,

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);

-- Ratings Table
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  ride_id UUID REFERENCES rides(id) UNIQUE,

  driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
  driver_review TEXT,
  rated_by_passenger_at TIMESTAMP,

  passenger_rating INT CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
  passenger_review TEXT,
  rated_by_driver_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ratings_ride ON ratings(ride_id);

-- Promo Codes Table
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,

  discount_type VARCHAR(20),
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

-- Notifications Table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES drivers(id),

  type VARCHAR(50),
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

-- Admin Users Table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',

  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_users_email ON admin_users(email);

-- Favorite Locations Table
CREATE TABLE favorite_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),

  label VARCHAR(100),
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_favorite_locations_user ON favorite_locations(user_id);

-- Functions to update average ratings
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE drivers
  SET average_rating = (
    SELECT COALESCE(AVG(driver_rating), 5.0)
    FROM ratings r
    JOIN rides ri ON r.ride_id = ri.id
    WHERE ri.driver_id = NEW.driver_id
      AND r.driver_rating IS NOT NULL
  )
  WHERE id = (SELECT driver_id FROM rides WHERE id = NEW.ride_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_rating
AFTER INSERT OR UPDATE ON ratings
FOR EACH ROW
WHEN (NEW.driver_rating IS NOT NULL)
EXECUTE FUNCTION update_driver_rating();

CREATE OR REPLACE FUNCTION update_passenger_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET average_rating = (
    SELECT COALESCE(AVG(passenger_rating), 5.0)
    FROM ratings r
    JOIN rides ri ON r.ride_id = ri.id
    WHERE ri.passenger_id = NEW.passenger_id
      AND r.passenger_rating IS NOT NULL
  )
  WHERE id = (SELECT passenger_id FROM rides WHERE id = NEW.ride_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_passenger_rating
AFTER INSERT OR UPDATE ON ratings
FOR EACH ROW
WHEN (NEW.passenger_rating IS NOT NULL)
EXECUTE FUNCTION update_passenger_rating();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

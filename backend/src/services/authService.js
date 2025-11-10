const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

class AuthService {
  generateToken(user, type) {
    return jwt.sign(
      { id: user.id, email: user.email, type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );
  }

  generateRefreshToken(user, type) {
    return jwt.sign(
      { id: user.id, type },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY }
    );
  }

  async registerUser(data) {
    const { email, phone, password, name } = data;

    // Check if user exists
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existing.rows.length > 0) {
      throw new Error('User with this email or phone already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS));

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, phone, password_hash, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, phone, name, created_at`,
      [email, phone, passwordHash, name]
    );

    const user = result.rows[0];
    const token = this.generateToken(user, 'user');
    const refreshToken = this.generateRefreshToken(user, 'user');

    return { user, token, refreshToken };
  }

  async loginUser(email, password) {
    const result = await db.query(
      'SELECT id, email, phone, password_hash, name, status FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    delete user.password_hash;

    const token = this.generateToken(user, 'user');
    const refreshToken = this.generateRefreshToken(user, 'user');

    return { user, token, refreshToken };
  }

  async registerDriver(data) {
    const {
      email, phone, password, name,
      vehicleType, vehicleMake, vehicleModel, vehicleYear,
      vehicleColor, vehiclePlate, licenseNumber, licenseExpiry
    } = data;

    // Check if driver exists
    const existing = await db.query(
      'SELECT id FROM drivers WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existing.rows.length > 0) {
      throw new Error('Driver with this email or phone already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS));

    // Create driver
    const result = await db.query(
      `INSERT INTO drivers (
        email, phone, password_hash, name,
        vehicle_type, vehicle_make, vehicle_model, vehicle_year,
        vehicle_color, vehicle_plate, license_number, license_expiry
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, email, phone, name, verification_status, created_at`,
      [email, phone, passwordHash, name,
       vehicleType, vehicleMake, vehicleModel, vehicleYear,
       vehicleColor, vehiclePlate, licenseNumber, licenseExpiry]
    );

    const driver = result.rows[0];

    return { driver };
  }

  async loginDriver(email, password) {
    const result = await db.query(
      `SELECT id, email, phone, password_hash, name, status, verification_status
       FROM drivers WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const driver = result.rows[0];

    const validPassword = await bcrypt.compare(password, driver.password_hash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await db.query(
      'UPDATE drivers SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [driver.id]
    );

    delete driver.password_hash;

    const token = this.generateToken(driver, 'driver');
    const refreshToken = this.generateRefreshToken(driver, 'driver');

    return { driver, token, refreshToken };
  }

  async loginAdmin(email, password) {
    const result = await db.query(
      `SELECT id, email, password_hash, name, role, is_active
       FROM admin_users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      throw new Error('Account is not active');
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await db.query(
      'UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [admin.id]
    );

    delete admin.password_hash;

    const token = this.generateToken(admin, 'admin');
    const refreshToken = this.generateRefreshToken(admin, 'admin');

    return { admin, token, refreshToken };
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      let user;
      if (decoded.type === 'user') {
        const result = await db.query('SELECT id, email, name FROM users WHERE id = $1', [decoded.id]);
        user = result.rows[0];
      } else if (decoded.type === 'driver') {
        const result = await db.query('SELECT id, email, name FROM drivers WHERE id = $1', [decoded.id]);
        user = result.rows[0];
      } else if (decoded.type === 'admin') {
        const result = await db.query('SELECT id, email, name FROM admin_users WHERE id = $1', [decoded.id]);
        user = result.rows[0];
      }

      if (!user) {
        throw new Error('User not found');
      }

      const newToken = this.generateToken(user, decoded.type);
      return { token: newToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}

module.exports = new AuthService();

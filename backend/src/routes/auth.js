const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const Joi = require('joi');

// Validation schemas
const userRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const driverRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required(),
  vehicleType: Joi.string().valid('economy', 'premium', 'suv').required(),
  vehicleMake: Joi.string().required(),
  vehicleModel: Joi.string().required(),
  vehicleYear: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required(),
  vehicleColor: Joi.string().required(),
  vehiclePlate: Joi.string().required(),
  licenseNumber: Joi.string().required(),
  licenseExpiry: Joi.date().required()
});

// User registration
router.post('/register/user', async (req, res) => {
  try {
    const { error } = userRegisterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User login
router.post('/login/user', async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await authService.loginUser(req.body.email, req.body.password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Driver registration
router.post('/register/driver', async (req, res) => {
  try {
    const { error } = driverRegisterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await authService.registerDriver(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Driver login
router.post('/login/driver', async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await authService.loginDriver(req.body.email, req.body.password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Admin login
router.post('/login/admin', async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await authService.loginAdmin(req.body.email, req.body.password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

module.exports = router;

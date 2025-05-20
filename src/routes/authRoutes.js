// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  updateProfile, 
  getProfile 
} = require('../controllers/authController');
const authenticateUser = require('../middleware/auth');
const { auth } = require('../middleware/auth');
// Auth routes
router.post('/register', register); // Only admins can register new admins
router.post('/login', login);
router.patch('/profile', auth, updateProfile);
router.get('/profile', auth, getProfile);

module.exports = router;
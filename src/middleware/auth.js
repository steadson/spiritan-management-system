// src/middleware/auth.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { UnauthenticatedError,UnauthorizedError } = require('../errors');

const auth = async (req, res, next) => {
  // Check header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Authentication invalid');
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Attach the user to the request object
    req.user = {
      userId: payload.userId,
      name: payload.name,
      role: payload.role
    };
    next();
  } catch (error) {
    throw new UnauthenticatedError('Authentication invalid');
  }
};
// Add a new middleware for role-based authorization
const authorizePermissions = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new UnauthorizedError('Unauthorized to access this route');
    }
    next();
  };
};


module.exports = { auth, authorizePermissions };
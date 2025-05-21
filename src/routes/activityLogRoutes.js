const express = require('express');
const router = express.Router();

const {
  getAllActivityLogs,
  getEntityActivityLogs
} = require('../controllers/activityLogController');

// Import both auth and authorizePermissions from auth.js
const { auth, authorizePermissions } = require('../middleware/auth');

// Only admins can access activity logs
router.route('/')
  .get(auth, authorizePermissions('admin'), getAllActivityLogs);

// Get logs for a specific entity
router.route('/entity/:entityType/:entityId')
  .get(auth, authorizePermissions('admin'), getEntityActivityLogs);

module.exports = router;
// src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getOverallStats, 
  getMembersWithOutstandingBalances,
  getMonthlyContributionReport,
  getYearlyContributionReport
} = require('../controllers/reportController');
const { auth } = require('../middleware/auth');

// Report routes
router.get('/stats', auth, getOverallStats);
router.get('/outstanding-balances', auth, getMembersWithOutstandingBalances);
router.get('/monthly', auth, getMonthlyContributionReport);
router.get('/yearly', auth, getYearlyContributionReport);

module.exports = router;

// src/routes/contributionRoutes.js
const express = require('express');
const router = express.Router();
const { 
  createContribution, 
  getAllContributions, 
  getContribution, 
  updateContribution, 
  deleteContribution,
  getMemberPaymentHistory
} = require('../controllers/contributionController');
const { auth } = require('../middleware/auth');

// Contribution routes
router.route('/')
  .post(auth, createContribution)
  .get(auth, getAllContributions);

router.route('/:id')
  .get(auth, getContribution)
  .patch(auth, updateContribution)
  .delete(auth, deleteContribution);

router.route('/member/:memberId')
  .get(auth, getMemberPaymentHistory);

module.exports = router;
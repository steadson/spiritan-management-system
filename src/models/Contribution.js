// src/models/Contribution.js - Contribution model
const mongoose = require('mongoose');

const ContributionSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: [true, 'Please provide member ID']
  },
  amount: {
    type: Number,
    required: [true, 'Please provide contribution amount'],
    min: 0
  },
  contributionDate: {
    type: Date,
    default: Date.now
  },
  contributionMonth: {
    type: Date,
    required: [true, 'Please provide contribution month']
  },
  expectedAmount: {
    type: Number,
    required: [true, 'Please provide expected contribution amount for this month'],
    min: 0
  },
  isFullPayment: {
    type: Boolean,
    default: false
  },
  remainingAmount: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank transfer', 'mobile money', 'check', 'other'],
    default: 'cash'
  },
  overpaymentAmount: {
    type: Number,
    default: 0
  },
  reference: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide the admin user who recorded this']
  }
}, { timestamps: true });
// Pre-save middleware to calculate if it's a full payment and remaining amount
ContributionSchema.pre('save', function(next) {
  // Calculate if this is a full payment
  this.isFullPayment = this.amount >= this.expectedAmount;
  
  // Calculate remaining amount (0 if paid in full or overpaid)
  this.remainingAmount = Math.max(0, this.expectedAmount - this.amount);
  
  next();
});
module.exports = mongoose.model('Contribution', ContributionSchema);
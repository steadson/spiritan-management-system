// src/models/Member.js - Member model
const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'Please provide a category'],
    enum: ['priest', 'deacon', 'member', 'elder', 'other'],
  },
  names: {
    type: String,
    required: [true, 'Please provide member name'],
    trim: true,
  },
  age: {
    type: String,
  
  },
  email: {
    type: String,
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email'
    ],
    unique:true
  },
  phoneNumber: {
    type: String,
    required: [true, 'Please provide a phone number'],
  },
  location: {
    type: String,
  
  },
  registrationDate: {
    type: Date,
    required: [true, 'Please provide registration date'],
    default: Date.now,
  },
  monthlyContributionAmount: {
    type: Number,
    required: [true, 'Please provide monthly contribution amount'],
    min: 0,
  },
  control: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active',
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required:[true, "Please provide the member's gender"]
  },
  createdBy: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide the admin user'],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for getting total expected contribution
MemberSchema.virtual('totalExpectedContribution').get(function() {
  const startDate = new Date(this.registrationDate);
  const currentDate = new Date();
  
  // Calculate months difference
  const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (currentDate.getMonth() - startDate.getMonth());
  
  // Add 1 to include the current month
  const totalMonths = monthsDiff + 1;
  
  return totalMonths * this.monthlyContributionAmount;
});

// Add virtual for calculating cumulative contribution
MemberSchema.virtual('cumulativeTotalAmount').get(async function() {
  const Contribution = mongoose.model('Contribution');
  const contributions = await Contribution.find({ member: this._id });
  
  return contributions.reduce((total, contrib) => total + contrib.amount, 0);
});

module.exports = mongoose.model('Member', MemberSchema);
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  
  amount_range: {
    type: String,
    required: true
  },
  plan_name: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'elite'],
    required: true
  },

  timestamp: {
    type: Date,
    default: Date.now
  }
});



module.exports = mongoose.model('contributionPlan', planSchema);
const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['create', 'read', 'update', 'delete'],
    required: true
  },
  resourceType: {
    type: String,
    enum: ['member', 'contribution', 'user', 'system'],
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  relatedEntities: [{
    entityType: {
      type: String,
      enum: ['member', 'contribution', 'user'],
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  }],
  description: {
    type: String,
    required: true
  },
  details: {
    type: Object,
    default: {}
  },
  ipAddress: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for faster querying
ActivityLogSchema.index({ resourceType: 1, resourceId: 1 });
ActivityLogSchema.index({ 'relatedEntities.entityType': 1, 'relatedEntities.entityId': 1 });
ActivityLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
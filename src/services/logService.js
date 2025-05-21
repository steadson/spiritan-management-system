const ActivityLog = require('../models/ActivityLog');

const logActivity = async (options) => {
  try {
    const {
      user,
      action,
      resourceType,
      resourceId,
      relatedEntities = [],
      description,
      details,
      ipAddress
    } = options;

    const log = await ActivityLog.create({
      user,
      action,
      resourceType,
      resourceId,
      relatedEntities,
      description,
      details,
      ipAddress
    });

    return log;
  } catch (error) {
    console.error('Error logging activity:', error);
    // We don't want to throw errors from the logging service
    // as it would interrupt the main application flow
  }
};

// Get logs for a specific entity
const getEntityLogs = async (entityType, entityId, options = {}) => {
  try {
    const { page = 1, limit = 20, sort = '-timestamp' } = options;
    const skip = (page - 1) * limit;

    // Query for logs where the entity is either the main resource or a related entity
    const query = {
      $or: [
        { resourceType: entityType, resourceId: entityId },
        { 'relatedEntities.entityType': entityType, 'relatedEntities.entityId': entityId }
      ]
    };

    const logs = await ActivityLog.find(query)
      .populate({
        path: 'user',
        select: 'name email role'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalLogs = await ActivityLog.countDocuments(query);
    const numOfPages = Math.ceil(totalLogs / limit);

    return {
      logs,
      totalLogs,
      numOfPages,
      currentPage: page
    };
  } catch (error) {
    console.error('Error getting entity logs:', error);
    throw error;
  }
};

module.exports = {
  logActivity,
  getEntityLogs
};
const { getEntityLogs } = require('../services/logService');
const ActivityLog = require('../models/ActivityLog');
const { StatusCodes } = require('http-status-codes');
const { NotFoundError } = require('../errors');

// Get all activity logs with pagination and filters
const getAllActivityLogs = async (req, res) => {
  const { user, action, resourceType, startDate, endDate, sort } = req.query;
  const queryObject = {};
  
  // Apply filters
  if (user) {
    queryObject.user = user;
  }
  
  if (action) {
    queryObject.action = action;
  }
  
  if (resourceType) {
    queryObject.resourceType = resourceType;
  }
  
  if (startDate && endDate) {
    queryObject.timestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else if (startDate) {
    queryObject.timestamp = { $gte: new Date(startDate) };
  } else if (endDate) {
    queryObject.timestamp = { $lte: new Date(endDate) };
  }
  
  // Pagination setup
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  // Sorting
  let sortOptions = { timestamp: -1 };
  if (sort) {
    const sortFields = sort.split(',').join(' ');
    sortOptions = sortFields;
  }
  
  const logs = await ActivityLog.find(queryObject)
    .populate({
      path: 'user',
      select: 'name email role'
    })
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);
  
  const totalLogs = await ActivityLog.countDocuments(queryObject);
  const numOfPages = Math.ceil(totalLogs / limit);
  
  res.status(StatusCodes.OK).json({
    logs,
    totalLogs,
    numOfPages,
    currentPage: page
  });
};

// Get activity logs for a specific entity (member, contribution, user)
const getEntityActivityLogs = async (req, res) => {
  const { entityType, entityId } = req.params;
  const { page, limit, sort } = req.query;
  
  // Validate entity type
  if (!['member', 'contribution', 'user'].includes(entityType)) {
    throw new BadRequestError(`Invalid entity type: ${entityType}`);
  }
  
  const result = await getEntityLogs(entityType, entityId, {
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    sort: sort || '-timestamp'
  });
  
  res.status(StatusCodes.OK).json(result);
};

module.exports = {
  getAllActivityLogs,
  getEntityActivityLogs
};
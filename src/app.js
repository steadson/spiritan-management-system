// src/app.js
const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimiter = require('express-rate-limit');

// Import routes
const authRouter = require('./routes/authRoutes');
const memberRouter = require('./routes/memberRoutes');
const contributionRouter = require('./routes/contributionRoutes');
const reportRouter = require('./routes/reportRoutes');
const activityLogRouter = require('./routes/activityLogRoutes');
// Import middleware
const authenticateUser = require('./middleware/auth');
const notFoundMiddleware = require('./middleware/notFound');
const errorHandlerMiddleware = require('./middleware/errorHandler');

// Security middleware
app.set('trust proxy', 1);
app.use('/api/v1/logs', activityLogRouter);
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  })
);
app.use(helmet());
app.use(cors());
app.use(xss());
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/members', memberRouter);
app.use('/api/v1/contributions', contributionRouter);
app.use('/api/v1/reports', reportRouter);

// Error handling
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

module.exports = app;
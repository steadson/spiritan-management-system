// server.js
require('dotenv').config();
require('express-async-errors');
const app = require('./src/app');
const connectDB = require('./src/utils/database');

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("DB connection successful...")
    app.listen(port, () => {
      console.log(`Server is listening on port ${port}...`);
    });
  } catch (error) {
    console.log(error);
  }
};

start();

const mongoose = require("mongoose");

/**
 * Connect to MongoDB using Mongoose.
 * Exits the process on failure to ensure the app doesn't run without a DB.
 */
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("❌ FATAL: MONGODB_URI environment variable is not set.");
    process.exit(1);
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

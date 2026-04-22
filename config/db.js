const mongoose = require("mongoose");

/**
 * Connect to MongoDB using Mongoose.
 * Exits the process on failure to ensure the app doesn't run without a DB.
 */
const connectDB = async () => {
  if (!process.mongodb://hvip11705_db_user:4RnGTo1U2ItgzsL8@ac-d5aysqs-shard-00-00.o4zvqph.mongodb.net:27017,ac-d5aysqs-shard-00-01.o4zvqph.mongodb.net:27017,ac-d5aysqs-shard-00-02.o4zvqph.mongodb.net:27017/?ssl=true&replicaSet=atlas-13096s-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Vero) {
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

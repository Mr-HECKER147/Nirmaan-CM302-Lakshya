const mongoose = require("mongoose");

async function connectDB() {
  const uri = String(process.env.MONGODB_URI || "").trim();

  if (!uri) {
    console.warn("MONGODB_URI not set");
    console.warn("MongoDB features unavailable");
    return false;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    console.error("MongoDB connection failed.", error.message);
    return false;
  }
}

module.exports = connectDB;

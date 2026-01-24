// server/reset_db.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Score = require('./models/Score');

const resetDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔌 Connected to Database...');

    // 1. Delete All Scores
    const scoreResult = await Score.deleteMany({});
    console.log(`🗑️  Deleted ${scoreResult.deletedCount} scores.`);

    // 2. Delete All Users
    const userResult = await User.deleteMany({});
    console.log(`🗑️  Deleted ${userResult.deletedCount} users.`);

    console.log('✨ Database is now completely empty.');
    process.exit();
  } catch (err) {
    console.error('❌ Error during reset:', err);
    process.exit(1);
  }
};

resetDatabase();
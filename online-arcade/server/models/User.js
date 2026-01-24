// server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true, // No two players can have the same name
    trim: true,   // Removes spaces from "  User  "
    minlength: 3
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  tickets: {
    type: Number,
    default: 0 // Everyone starts with 0 tickets
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
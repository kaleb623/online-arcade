// server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: true,
    minlength: 3
  },
  // --- NEW SOCIAL FIELDS ---
  avatar: {
    type: String, 
    default: 'default_avatar.png' 
  },
  statusMessage: {
    type: String,
    default: 'Available',
    maxlength: 50
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // -------------------------
  tickets: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
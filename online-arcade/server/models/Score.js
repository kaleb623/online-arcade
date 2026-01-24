// server/models/Score.js
const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: { 
    type: String, 
    required: true 
  },
  game: { 
    type: String, 
    required: true 
  },
  score: { 
    type: Number, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Score', ScoreSchema);
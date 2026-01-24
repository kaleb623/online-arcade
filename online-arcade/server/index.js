require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const User = require('./models/User');
const Score = require('./models/Score'); // <-- NEW: Import Score Model

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send('Arcade Backend is Running!');
});

// Register Route
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "Username already taken" });
    const newUser = new User({ username, password });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully!", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Simple password check
    if (user.password !== password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3. Success!
    res.json({ message: "Login successful", username: user.username });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// --- NEW ROUTES BELOW ---

// 1. Submit Score Route
app.post('/api/score', async (req, res) => {
  try {
    const { username, game, score } = req.body;

    // Find the user to ensure they exist
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if they already played this game
    const existingScore = await Score.findOne({ userId: user._id, game: game });

    if (existingScore) {
      // Only update if the new score is higher
      if (score > existingScore.score) {
        existingScore.score = score;
        await existingScore.save();
        return res.status(200).json({ message: "New High Score!", newHighScore: true });
      }
      return res.status(200).json({ message: "Score not higher than previous best.", newHighScore: false });
    }

    // First time playing? Save the score.
    const newScore = new Score({ userId: user._id, username: user.username, game: game, score: score });
    await newScore.save();
    res.status(201).json({ message: "First score submitted!", newHighScore: true });

  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 2. Get Leaderboard Route
app.get('/api/leaderboard/:game', async (req, res) => {
  try {
    const { game } = req.params;
    // Get top 10 scores, sorted by score (descending)
    const topScores = await Score.find({ game: game }).sort({ score: -1 }).limit(10);
    res.json(topScores);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
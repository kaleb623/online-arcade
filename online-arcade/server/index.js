// server/index.js
const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 
const mongoose = require('mongoose');
const path = require('path'); 

const app = express();
app.use(express.json());
app.use(cors());

// --- 1. DATABASE CONNECTION ---
// Works with a cloud URI (if you have one) or defaults to local
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online-arcade';

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

// --- 2. MODELS ---
// We try to import your models, or define them here if files are missing
let User, Score;
try {
    User = require('./models/User');
    Score = require('./models/Score');
} catch (e) {
    // Fallback Schemas
    const userSchema = new mongoose.Schema({ username: String, password: String });
    User = mongoose.model('User', userSchema);
    const scoreSchema = new mongoose.Schema({ username: String, game: String, score: Number });
    Score = mongoose.model('Score', scoreSchema);
}

// --- 3. API ROUTES ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const newUser = await User.create({ username, password });
        // FIX: Return a clear structure with 'user' (name) and 'message'
        res.json({ 
            status: 'ok', 
            message: 'Registration successful!', 
            user: newUser.username 
        });
    } catch (err) {
        res.status(400).json({ error: "User exists" });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username, password });
    
    if(foundUser) {
        // FIX: Match the register structure
        res.json({ 
            status: 'ok', 
            message: 'Welcome back!', 
            user: foundUser.username 
        });
    } else {
        res.status(400).json({ status: 'error', user: false });
    }
});

app.post('/api/score', async (req, res) => {
    const { username, game, score } = req.body;
    await Score.create({ username, game, score });
    res.json({ status: 'saved' });
});

app.get('/api/leaderboard/:game', async (req, res) => {
    const scores = await Score.find({ game: req.params.game }).sort({ score: -1 }).limit(10);
    res.json(scores);
});

// --- 4. MULTIPLAYER SOCKETS ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

io.on('connection', (socket) => {
    console.log(`⚡ User Connected: ${socket.id}`);
    
    socket.on('create_room', () => {
        const roomCode = generateRoomCode();
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
    });

    socket.on('join_room', (roomCode) => {
        const room = io.sockets.adapter.rooms.get(roomCode);
        if (room && room.size === 1) {
            socket.join(roomCode);
            const [hostId] = room;
            // Notify both players
            io.to(hostId).emit('game_start', { color: 'red', room: roomCode, opponent: socket.id }); 
            io.to(socket.id).emit('game_start', { color: 'black', room: roomCode, opponent: hostId }); 
        } else {
            socket.emit('error_joining', 'Room invalid');
        }
    });

    socket.on('make_move', (data) => {
        socket.to(data.room).emit('opponent_move', data.move);
    });
});

// --- 5. SERVE FRONTEND (THE MONOLITH BLOCK) ---
// This serves the React files if the user isn't asking for an API
try {
    app.use(express.static(path.join(__dirname, '../client/dist')));
    
    // Catch-all route: Send React's index.html
    app.get('*', (req, res) => {
        // Safety check: Don't return HTML for API calls
        if(req.path.startsWith('/api')) return res.status(404);
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
} catch (e) {
    console.log("Dev Mode: Not serving frontend.");
}

// --- 6. START SERVER ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
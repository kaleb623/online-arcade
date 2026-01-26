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
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online-arcade';

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

// --- 2. MODELS ---
let User, Score;
try {
    User = require('./models/User');
    Score = require('./models/Score');
} catch (e) {
    // Fallback schemas if files are missing
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
    try {
        const { username, password } = req.body;
        const foundUser = await User.findOne({ username, password });
        if(foundUser) {
            res.json({ 
                status: 'ok', 
                message: 'Welcome back!', 
                user: foundUser.username 
            });
        } else {
            res.status(400).json({ status: 'error', user: false });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- LEADERBOARD POST ---
app.post('/api/score', async (req, res) => {
    try {
        const { username, game, score } = req.body;

        // 1. Find the User to get their actual MongoDB _id
        const userDoc = await User.findOne({ username });

        if (!userDoc) {
            return res.status(404).json({ error: "User not found in database" });
        }

        // 2. Create the score using that _id
        await Score.create({ 
            userId: userDoc._id, 
            username: username, 
            game, 
            score 
        });

        res.json({ status: 'saved' });
    } catch (err) {
        console.error("❌ Score Save Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leaderboard/:game', async (req, res) => {
    try {
        const scores = await Score.find({ game: req.params.game }).sort({ score: -1 }).limit(10);
        res.json(scores);
    } catch (err) {
        console.error("❌ Error fetching leaderboard:", err);
        res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
});

// --- 4. MULTIPLAYER SOCKETS ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// == Checkers Logic == //
io.on('connection', (socket) => {
    console.log(`Checkers⚡ User Connected: ${socket.id}`);
    
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
            io.to(hostId).emit('game_start', { color: 'red', room: roomCode, opponent: socket.id }); 
            io.to(socket.id).emit('game_start', { color: 'black', room: roomCode, opponent: hostId }); 
        } else {
            socket.emit('error_joining', 'Room invalid');
        }
    });

    socket.on('make_move', (data) => {
        socket.to(data.room).emit('opponent_move', data.move);
    });

    // Timeout Logic
    socket.on("turn_timeout", (data) => {
        io.in(data.room).emit("turn_timeout", { nextTurn: data.nextTurn });
    });

    // Forfeit Logic
    socket.on("forfeit_game", (data) => {
        io.in(data.room).emit("game_over", { winner: data.winner, reason: 'timeout' });
    });
});

// --- 5. THE CATCH-ALL ---
app.use(express.static(path.join(__dirname, '../client/dist')));

// Updated regex syntax for newer library compatibility
app.get(/(.*)/, (req, res) => {
    if(req.path.startsWith('/api')) return res.status(404);
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// --- 6. START SERVER ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
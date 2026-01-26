// server/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 

const app = express();
app.use(express.json());
app.use(cors());

// --- DATABASE CONNECTION ---
mongoose.connect('mongodb://127.0.0.1:27017/online-arcade')
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

// --- ROUTES ---
const Score = require('./models/Score');
const User = require('./models/User');

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const newUser = await User.create({ username, password });
        res.json(newUser);
    } catch (err) {
        res.status(400).json({ error: "User already exists" });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if(user) res.json({ status: 'ok', user: user.username });
    else res.status(400).json({ status: 'error', user: false });
});

app.post('/api/score', async (req, res) => {
    const { username, game, score } = req.body;
    await Score.create({ username, game, score });
    res.json({ status: 'saved' });
});

app.get('/api/leaderboard/:game', async (req, res) => {
    const scores = await Score.find({ game: req.params.game })
        .sort({ score: -1 })
        .limit(10);
    res.json(scores);
});

// --- 🔌 SOCKET.IO LOBBY SYSTEM ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", 
        methods: ["GET", "POST"]
    }
});

// Helper to generate 4-letter codes
const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
};

io.on('connection', (socket) => {
    console.log(`⚡ User Connected: ${socket.id}`);

    // --- CREATE ROOM ---
    socket.on('create_room', () => {
        const roomCode = generateRoomCode();
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
        console.log(`🏠 Room Created: ${roomCode} by ${socket.id}`);
    });

    // --- JOIN ROOM ---
    socket.on('join_room', (roomCode) => {
        // Check if room exists
        const room = io.sockets.adapter.rooms.get(roomCode);
        
        if (room && room.size === 1) {
            // Success! Join the room
            socket.join(roomCode);
            
            // Get the ID of the creator (Host)
            const [hostId] = room;

            // Notify Players
            io.to(hostId).emit('game_start', { color: 'red', room: roomCode, opponent: socket.id }); 
            io.to(socket.id).emit('game_start', { color: 'black', room: roomCode, opponent: hostId }); 
            
            console.log(`🎮 Game Started in Room: ${roomCode}`);
        } else {
            // Fail
            socket.emit('error_joining', 'Room invalid or full');
        }
    });

    // --- GAME MOVES ---
    socket.on('make_move', (data) => {
        socket.to(data.room).emit('opponent_move', data.move);
    });

    socket.on('disconnect', () => {
        console.log(`❌ User Disconnected: ${socket.id}`);
    });
});

server.listen(5000, () => {
    console.log("🚀 Server running on port 5000 (HTTP + Socket.io)");
});
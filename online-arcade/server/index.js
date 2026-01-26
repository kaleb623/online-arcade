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
        res.json({ status: 'ok', user: newUser.username });
    } catch (err) {
        res.status(400).json({ error: "User exists" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const foundUser = await User.findOne({ username, password });
        if(foundUser) {
            res.json({ status: 'ok', user: foundUser.username });
        } else {
            res.status(400).json({ status: 'error', user: false });
        }
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/score', async (req, res) => {
    try {
        const { username, game, score } = req.body;
        const userDoc = await User.findOne({ username });
        if (!userDoc) return res.status(404).json({ error: "User not found" });

        await Score.create({ 
            userId: userDoc._id, 
            username: username, 
            game, 
            score 
        });
        res.json({ status: 'saved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leaderboard/:game', async (req, res) => {
    try {
        const scores = await Score.find({ game: req.params.game }).sort({ score: -1 }).limit(10);
        res.json(scores);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
});

// --- 4. MULTIPLAYER SOCKETS ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Track player metadata (usernames) per room
const checkersRooms = new Map();

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

io.on('connection', (socket) => {
    console.log(`Checkers⚡ User Connected: ${socket.id}`);
    
    socket.on('create_room', () => {
        const roomCode = generateRoomCode();
        checkersRooms.set(roomCode, { players: [], names: {} });
        socket.emit('room_created', roomCode);
    });

    socket.on('join_room', (data) => {
        const roomCode = typeof data === 'string' ? data : data.roomCode;
        const username = data.username || "Guest";
        
        const roomData = checkersRooms.get(roomCode);
        const socketRoom = io.sockets.adapter.rooms.get(roomCode);

        // Allow join if room exists and has < 2 players
        if (roomData && (!socketRoom || socketRoom.size < 2)) {
            socket.join(roomCode);
            roomData.players.push(socket.id);
            roomData.names[socket.id] = username;

            if (roomData.players.length === 2) {
                const p1Id = roomData.players[0];
                const p2Id = roomData.players[1];
                const namesMapping = {
                    red: roomData.names[p1Id],
                    black: roomData.names[p2Id]
                };

                io.to(p1Id).emit('game_start', { 
                    color: 'red', 
                    room: roomCode, 
                    names: namesMapping 
                }); 
                io.to(p2Id).emit('game_start', { 
                    color: 'black', 
                    room: roomCode, 
                    names: namesMapping 
                }); 
            }
        } else {
            socket.emit('error_joining', 'Room full or invalid');
        }
    });

    socket.on('make_move', (data) => {
        socket.to(data.room).emit('opponent_move', data.move);
    });

    socket.on("forfeit_game", (data) => {
        io.in(data.room).emit("game_over", { winner: data.winner });
    });

    socket.on('disconnect', () => {
        // Basic cleanup: find rooms the socket was in and remove them
        checkersRooms.forEach((data, code) => {
            if (data.players.includes(socket.id)) checkersRooms.delete(code);
        });
    });
});

// --- 5. THE CATCH-ALL ---
app.use(express.static(path.join(__dirname, '../client/dist')));

app.get(/(.*)/, (req, res) => {
    if(req.path.startsWith('/api')) return res.status(404);
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
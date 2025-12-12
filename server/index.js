// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;

// --- Database setup (MongoDB) ---
const MONGODB_URI = process.env.MONGODB_URI || null;
let scoresCollection = null;
async function initDB() {
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI not set — leaderboard will use in-memory storage for this run.');
    return;
  }
  const client = new MongoClient(MONGODB_URI, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'tetrisdb');
  scoresCollection = db.collection('scores');
  await scoresCollection.createIndex({ score: -1 });
  console.log('Connected to MongoDB');
}
initDB().catch(err => {
  console.error('DB init error:', err);
});

// Fallback in-memory scores if no Mongo
const inMemoryScores = [];

// --- Leaderboard API ---
app.post('/api/score', async (req, res) => {
  try {
    const { username, score } = req.body;
    if (!username || typeof score !== 'number') return res.status(400).json({ error: 'username and numeric score required' });
    const entry = { username, score, ts: new Date() };
    if (scoresCollection) {
      await scoresCollection.insertOne(entry);
    } else {
      inMemoryScores.push(entry);
      inMemoryScores.sort((a,b) => b.score - a.score);
      if (inMemoryScores.length > 100) inMemoryScores.length = 100;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  try {
    if (scoresCollection) {
      const rows = await scoresCollection.find().sort({ score: -1 }).limit(limit).toArray();
      return res.json(rows.map(r => ({ username: r.username, score: r.score, ts: r.ts })));
    } else {
      return res.json(inMemoryScores.slice(0, limit));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// --- Simple matchmaking & game relay using Socket.io ---
const waitingQueue = []; // socket.id queue
const rooms = {}; // roomId -> { players: [socketId,...] }

function makeRoomId() {
  return 'room-' + Math.random().toString(36).slice(2, 9);
}

io.on('connection', socket => {
  console.log('conn', socket.id);

  socket.on('join-queue', ({ username }) => {
    socket.data.username = username || 'Anon';
    if (waitingQueue.length === 0) {
      waitingQueue.push(socket.id);
      socket.emit('queued');
    } else {
      const otherId = waitingQueue.shift();
      const roomId = makeRoomId();
      rooms[roomId] = { players: [otherId, socket.id] };
      [otherId, socket.id].forEach(id => {
        io.to(id).emit('matched', { roomId, opponent: (id === otherId) ? socket.data.username : (io.sockets.sockets.get(otherId)?.data?.username || 'Opponent') });
      });
      // join sockets to room
      io.sockets.sockets.get(otherId)?.join(roomId);
      socket.join(roomId);
      console.log('matched', roomId, otherId, socket.id);
    }
  });

  socket.on('leave-queue', () => {
    const idx = waitingQueue.indexOf(socket.id);
    if (idx !== -1) waitingQueue.splice(idx, 1);
  });

  socket.on('disconnect', () => {
    // clean waiting queue
    const idx = waitingQueue.indexOf(socket.id);
    if (idx !== -1) waitingQueue.splice(idx, 1);
    // notify rooms
    for (const [roomId, info] of Object.entries(rooms)) {
      if (info.players.includes(socket.id)) {
        socket.to(roomId).emit('opponent-disconnect');
        delete rooms[roomId];
        break;
      }
    }
  });

  // Relay events inside room
  socket.on('game-event', ({ roomId, type, payload }) => {
    // types: board, piecePlaced, sendGarbage, lost, ping, etc.
    socket.to(roomId).emit('game-event', { from: socket.id, type, payload });
  });

  socket.on('chat', ({ roomId, text }) => {
    socket.to(roomId).emit('chat', { from: socket.data.username, text });
  });
});

server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});

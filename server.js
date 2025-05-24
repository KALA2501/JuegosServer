const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const startKafkaConsumer = require('./kafkaConsumer');

const app = express();
const PORT = process.env.PORT || 9094;

// Store userId → game mapping from Kafka
const sessionMap = {};

// Set of WebSocket clients
const clients = new Set();

// CORS: allow frontend access
app.use(cors({
  origin: ['http://localhost:3000', 'http://frontend:3000'],
  credentials: true
}));

// Serve Unity WebGL games dynamically
app.use('/games/:gameName', (req, res, next) => {
  const gameName = req.params.gameName.toLowerCase();
  const gamePath = path.join(__dirname, 'games', gameName);
  if (!fs.existsSync(gamePath)) return res.status(404).send('Game not found');
  express.static(gamePath)(req, res, next);
});

app.get('/games/:gameName', (req, res) => {
  const gameName = req.params.gameName.toLowerCase();
  const indexPath = path.join(__dirname, 'games', gameName, 'index.html');
  if (!fs.existsSync(indexPath)) return res.status(404).send('index.html not found');
  res.sendFile(indexPath);
});

// Optional route to play based on Kafka-mapped session
app.get('/play/:userId', (req, res) => {
  const userId = req.params.userId;
  const game = sessionMap[userId];
  if (!game) return res.status(404).send('User has no game assigned');
  const indexPath = path.join(__dirname, 'games', game, 'index.html');
  if (!fs.existsSync(indexPath)) return res.status(404).send('Game not found');
  res.sendFile(indexPath);
});

// MySQL DB connection
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'kala',
  port: process.env.DB_PORT || 3306,
});

// HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace(/^.*\?/, ''));
  const userId = params.get('userId');
  ws.userId = userId;
  clients.add(ws);
  console.log(`Unity client connected (userId: ${userId})`);
  ws.send(JSON.stringify({ type: 'welcome', message: 'WebSocket connected.' }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected (userId: ${userId})`);
  });

  ws.on('error', (err) => {
    clients.delete(ws);
    console.error(`WS error (userId: ${userId}):`, err);
  });
});

// Metrics API from Unity
app.use(express.json());

app.post('/send-metrics/:game', async (req, res) => {
  const { userId, tiempo, puntaje, errores } = req.body;
  const game = req.params.game.toLowerCase();
  if (!userId || tiempo == null || puntaje == null || errores == null) {
    return res.status(400).send('Missing metrics fields.');
  }

  const table = `${game}_metrics`;
  try {
    const conn = await dbPool.getConnection();
    await conn.query(
      `INSERT INTO \`${table}\` (user_id, tiempo, puntaje, errores) VALUES (?, ?, ?, ?)`,
      [userId, tiempo, puntaje, errores]
    );
    conn.release();
    console.log(`Inserted metrics into ${table}`);
    res.send('Metrics saved.');
  } catch (err) {
    console.error(`DB error (${table}):`, err);
    res.status(500).send('DB error.');
  }
});

// ✅ Kafka listener → maps userId to game + notifies Unity via WebSocket
startKafkaConsumer(({ userId, game }) => {
  const normalizedGame = game.toLowerCase();
  sessionMap[userId] = normalizedGame;
  console.log(`🎮 Mapped user ${userId} → ${normalizedGame}`);

  // Notify Unity if connected
  for (const ws of clients) {
    if (ws.userId === userId) {
      ws.send(JSON.stringify({
        type: 'session-start',
        userId,
        game: normalizedGame
      }));
    }
  }
});

// ✅ Clean shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await dbPool.end();
  server.close(() => {
    console.log('Server closed');
  });
});

// ✅ Start the server
server.listen(PORT, () => {
  console.log(`Game server running on http://localhost:${PORT}`);
});

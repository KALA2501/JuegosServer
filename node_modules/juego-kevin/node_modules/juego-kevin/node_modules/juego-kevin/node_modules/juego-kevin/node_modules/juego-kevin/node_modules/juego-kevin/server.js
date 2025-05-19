const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 9094;

// ✅ CORS: Permitir peticiones desde frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://frontend:3000'],
  credentials: true
}));

// ✅ Servir múltiples juegos Unity WebGL dinámicamente
app.use('/games/:gameName', (req, res, next) => {
  const gameName = req.params.gameName;
  const gamePath = path.join(__dirname, 'games', gameName);

  // Si no existe la carpeta del juego, devuelve 404
  if (!fs.existsSync(gamePath)) {
    return res.status(404).send('Juego no encontrado');
  }

  // Sirve contenido estático (index.html, Build/, TemplateData/)
  express.static(gamePath)(req, res, next);
});

// ✅ Redireccionar directamente al index.html del juego
app.get('/games/:gameName', (req, res) => {
  const gameName = req.params.gameName;
  const indexPath = path.join(__dirname, 'games', gameName, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Archivo index.html no encontrado');
  }

  res.sendFile(indexPath);
});

// ✅ Conexión a MySQL
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'kala',
  port: process.env.DB_PORT || 3306,
});

// ✅ WebSocket para conexión Unity
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace(/^.*\?/, ''));
  const userId = params.get('userId');
  ws.userId = userId;
  clients.add(ws);

  console.log(`Unity client connected for userId: ${userId}`);
  ws.send(JSON.stringify({ message: 'Connected to WebSocket server.' }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Unity client for ${userId} disconnected`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for userId ${userId}:`, error);
    clients.delete(ws);
  });
});

// ✅ Parseo de JSON
app.use(express.json());

// ✅ Guardar métricas del juego
app.post('/send-metrics/:game', async (req, res) => {
  const { userId, tiempo, puntaje, errores } = req.body;
  const game = req.params.game;

  if (!userId || tiempo == null || puntaje == null || errores == null) {
    return res.status(400).send('Faltan métricas');
  }

  const table = `${game.toLowerCase()}_metrics`;

  try {
    const conn = await dbPool.getConnection();
    await conn.query(
      `INSERT INTO \`${table}\` (user_id, tiempo, puntaje, errores) VALUES (?, ?, ?, ?)`,
      [userId, tiempo, puntaje, errores]
    );
    conn.release();
    console.log(`✅ Métricas insertadas en ${table}`);
    res.status(200).send('Métricas insertadas correctamente.');
  } catch (err) {
    console.error(`❌ Error al insertar en ${table}:`, err);
    res.status(500).send('Error al insertar métricas.');
  }
});

// ✅ Cierre limpio
process.on('SIGINT', async () => {
  console.log('🛑 Apagando servidor...');
  await dbPool.end();
  server.close(() => {
    console.log('🧼 Servidor cerrado limpiamente.');
  });
});

// ✅ Arrancar servidor
server.listen(PORT, () => {
  console.log(`✅ Juegos-service corriendo en: http://localhost:${PORT}`);
});

const express = require('express');
const path = require('path');

const app = express();
const PORT = 9094;

// Serve Unity WebGL files
app.use('/game', express.static(path.join(__dirname, 'WebGL')));

// Default route
app.get('/', (req, res) => {
  res.send('<h1>Welcome! Go to <a href="/game">/game</a> to play the game</h1>');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

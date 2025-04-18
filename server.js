const express = require('express');
const path = require('path');

const app = express();
const PORT = 9094;

// Serve Cubiertos Game
app.use('/Cubiertos', express.static(path.join(__dirname, 'Cubiertos')));
app.get('/Cubiertos', (req, res) => {
  res.sendFile(path.join(__dirname, 'Cubiertos/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

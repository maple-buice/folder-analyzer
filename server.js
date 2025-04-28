import express from 'express';

const app = express();
const port = 3001;

app.use(express.json());

app.post('/api/analyze-folder', (req, res) => {
  const { path } = req.body;
  console.log(`Received folder path: ${path}`);
  // Perform folder analysis here
  res.json({ message: 'Folder analysis complete', path });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

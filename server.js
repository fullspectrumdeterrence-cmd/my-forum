const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = 'posts.json';

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve your HTML/CSS/JS files

// Load posts from file
let posts = [];
if (fs.existsSync(DATA_FILE)) {
  posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Get all posts
app.get('/api/posts', (req, res) => {
  res.json(posts);
});

// Add a new post
app.post('/api/posts', (req, res) => {
  const { text, author, category } = req.body;
  if (!text || !author || !category) return res.status(400).send('Missing data');

  const post = { text, author, category, replies: [] };
  posts.push(post);
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
  res.json(post);
});

// Add a reply
app.post('/api/posts/:index/replies', (req, res) => {
  const index = parseInt(req.params.index);
  const { text, author } = req.body;

  if (!text || !author) return res.status(400).send('Missing data');
  if (!posts[index]) return res.status(404).send('Post not found');

  const reply = { text, author };
  posts[index].replies.push(reply);
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
  res.json(reply);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
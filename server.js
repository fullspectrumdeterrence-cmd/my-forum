const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 PASTE YOUR CONNECTION STRING HERE (replace password)
const uri = "mongodb+srv://forumUser:Forum12345%21@cluster0.cbukuas.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri);
let db;

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db("forumDB");
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}

connectDB();


// Get all posts
app.get('/api/posts', async (req, res) => {
  const posts = await db.collection('posts').find().toArray();
  res.json(posts);
});


// Add a new post
app.post('/api/posts', async (req, res) => {
  const { text, author, category } = req.body;

  if (!text || !author || !category) {
    return res.status(400).send('Missing data');
  }

  const post = {
    text,
    author,
    category,
    replies: []
  };

  await db.collection('posts').insertOne(post);
  res.json(post);
});


// Add a reply
app.post('/api/posts/:index/replies', async (req, res) => {
  const { text, author } = req.body;
  const index = parseInt(req.params.index);

  if (!text || !author) return res.status(400).send('Missing data');

  const posts = await db.collection('posts').find().toArray();
  const post = posts[index];

  if (!post) return res.status(404).send('Post not found');

  post.replies.push({ text, author });

  await db.collection('posts').updateOne(
    { _id: post._id },
    { $set: { replies: post.replies } }
  );

  res.json({ text, author });
});


// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
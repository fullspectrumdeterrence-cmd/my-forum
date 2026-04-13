const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 PASTE YOUR CONNECTION STRING HERE (replace password)
const uri = process.env.MONGO_URI;

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
app.post('/api/posts/:id/replies', async (req, res) => {
  const { text, author } = req.body;
  const postId = req.params.id;

  if (!text || !author) return res.status(400).send('Missing data');

  const post = await db.collection('posts').findOne({ _id: new require('mongodb').ObjectId(postId) });

  if (!post) return res.status(404).send('Post not found');

  const updatedReplies = [...post.replies, { text, author }];

  await db.collection('posts').updateOne(
    { _id: new require('mongodb').ObjectId(postId) },
    { $set: { replies: updatedReplies } }
  );

  res.json({ text, author });
});


// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

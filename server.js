const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection string (from Render env variable)
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri);
let db;

// Middleware
app.use(express.json());
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


// =========================
// GET ALL POSTS
// =========================
app.get('/api/posts', async (req, res) => {
  const posts = await db.collection('posts').find().toArray();
  res.json(posts);
});


// =========================
// ADD NEW POST
// =========================
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

  const result = await db.collection('posts').insertOne(post);

  // return post WITH _id (important)
  res.json({ ...post, _id: result.insertedId });
});


// =========================
// ADD REPLY (FIXED)
// =========================
app.post('/api/posts/:id/replies', async (req, res) => {
  const { text, author } = req.body;
  const postId = req.params.id;

  if (!text || !author) {
    return res.status(400).send('Missing data');
  }

  try {
    const post = await db.collection('posts').findOne({
      _id: new ObjectId(postId)
    });

    if (!post) {
      return res.status(404).send('Post not found');
    }

    const newReply = { text, author };

    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { $push: { replies: newReply } }
    );

    res.json(newReply);

  } catch (err) {
    console.error("❌ Reply error:", err);
    res.status(500).send("Server error");
  }
});


// =========================
// START SERVER
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

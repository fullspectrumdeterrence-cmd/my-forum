const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection string (Render env variable)
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri);
let db;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));


// =========================
// CONNECT TO MONGODB
// =========================
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
    replies: [],
    createdAt: new Date()
  };

  const result = await db.collection('posts').insertOne(post);

  res.json({ ...post, _id: result.insertedId });
});


// =========================
// UPDATE POST (NEW)
// =========================
app.put('/api/posts/:id', async (req, res) => {
  const { text } = req.body;

  try {
    await db.collection('posts').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { text } }
    );

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Update post error:", err);
    res.status(500).send("Server error");
  }
});


// =========================
// DELETE POST (NEW)
// =========================
app.delete('/api/posts/:id', async (req, res) => {
  try {
    await db.collection('posts').deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Delete post error:", err);
    res.status(500).send("Server error");
  }
});


// =========================
// ADD REPLY
// =========================
app.post('/api/posts/:id/replies', async (req, res) => {
  const { text, author } = req.body;

  if (!text || !author) {
    return res.status(400).send('Missing data');
  }

  try {
    const newReply = { text, author, createdAt: new Date() };

    await db.collection('posts').updateOne(
      { _id: new ObjectId(req.params.id) },
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

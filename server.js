const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// SECTION 1: MONGO SETUP
// =========================
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db;

// =========================
// MIDDLEWARE
// =========================
app.use(express.json());
app.use(express.static(__dirname));


// =========================
// SECTION 2: CONNECT TO MONGODB
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
// SECTION 3: POSTS API
// =========================

// GET ALL POSTS
app.get('/api/posts', async (req, res) => {
  const posts = await db.collection('posts').find().toArray();
  res.json(posts);
});

// ADD NEW POST
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


// UPDATE POST
app.put('/api/posts/:id', async (req, res) => {
  try {
    await db.collection('posts').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { text: req.body.text } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// DELETE POST
app.delete('/api/posts/:id', async (req, res) => {
  try {
    await db.collection('posts').deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// =========================
// SECTION 4: REPLIES API
// =========================

// ADD REPLY
app.post('/api/posts/:id/replies', async (req, res) => {
  const { text, author } = req.body;

  if (!text || !author) {
    return res.status(400).send('Missing data');
  }

  try {
    const newReply = {
      text,
      author,
      createdAt: new Date()
    };

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
// SECTION 5: THREAD ROUTES (NEW)
// =========================

// LOAD THREAD PAGE (frontend handles rendering)
app.get('/post/:id', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// GET SINGLE POST (THREAD DATA)
app.get('/api/post/:id', async (req, res) => {
  try {
    const post = await db.collection('posts').findOne({
      _id: new ObjectId(req.params.id)
    });

    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// =========================
// SECTION 6: START SERVER
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

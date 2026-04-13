// =========================
// 1. IMPORTS
// =========================
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

// =========================
// 2. APP SETUP
// =========================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// =========================
// 3. DATABASE CONNECTION
// =========================
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("forumDB");
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB error:", err);
  }
}

connectDB();


// =========================
// 4. SEED DATA
// =========================
app.get('/api/seed', async (req, res) => {
  try {
    await db.collection('categories').deleteMany({});
    await db.collection('subforums').deleteMany({});

    const cats = await db.collection('categories').insertMany([
      { name: "General" },
      { name: "Technology" },
      { name: "News" }
    ]);

    const ids = Object.values(cats.insertedIds);

    await db.collection('subforums').insertMany([
      { name: "Introductions", categoryId: ids[0] },
      { name: "Announcements", categoryId: ids[0] },
      { name: "Hardware", categoryId: ids[1] },
      { name: "Software", categoryId: ids[1] },
      { name: "World News", categoryId: ids[2] }
    ]);

    res.send("Seeded categories + subforums");
  } catch (err) {
    console.error(err);
    res.status(500).send("Seed failed");
  }
});


// =========================
// 5. CATEGORIES
// =========================
app.get('/api/categories', async (req, res) => {
  const data = await db.collection('categories').find().toArray();
  res.json(data);
});


// =========================
// 6. SUBFORUMS (FIXED)
// =========================
app.get('/api/subforums/:categoryId', async (req, res) => {
  const data = await db.collection('subforums')
    .find({ categoryId: new ObjectId(req.params.categoryId) })
    .toArray();

  res.json(data);
});


// =========================
// 7. THREADS
// =========================

// GET threads
app.get('/api/threads/:subforumId', async (req, res) => {
  try {
    const threads = await db.collection('threads')
      .find({ subforumId: req.params.subforumId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(threads);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching threads");
  }
});

// CREATE thread
app.post('/api/threads', async (req, res) => {
  try {
    const { title, subforumId, author } = req.body;

    if (!title || !subforumId || !author) {
      return res.status(400).send("Missing data");
    }

    const thread = {
      title,
      subforumId,
      author,
      createdAt: new Date(),
      pinned: false,
      locked: false
    };

    const result = await db.collection('threads').insertOne(thread);

    res.json({ ...thread, _id: result.insertedId });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating thread");
  }
});


// =========================
// 8. POSTS (REPLIES)
// =========================

// GET posts
app.get('/api/posts/:threadId', async (req, res) => {
  try {
    const posts = await db.collection('posts')
      .find({ threadId: req.params.threadId })
      .sort({ createdAt: 1 })
      .toArray();

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching posts");
  }
});

// ADD post
app.post('/api/posts', async (req, res) => {
  try {
    const { threadId, text, author } = req.body;

    if (!threadId || !text || !author) {
      return res.status(400).send("Missing data");
    }

    const post = {
      threadId,
      text,
      author,
      createdAt: new Date()
    };

    const result = await db.collection('posts').insertOne(post);

    res.json({ ...post, _id: result.insertedId });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating post");
  }
});


// =========================
// 9. START SERVER
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

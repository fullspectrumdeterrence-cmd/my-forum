const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

app.use(express.json());
app.use(express.static(__dirname));

// =========================
// CONNECT DB
// =========================
async function connectDB() {
  try {
    await client.connect();
    db = client.db("forumDB");
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ DB error:", err);
  }
}
connectDB();

// =========================
// CATEGORIES
// =========================
app.get('/api/categories', async (req, res) => {
  const data = await db.collection('categories').find().toArray();
  res.json(data);
});

// =========================
// SUBFORUMS
// =========================
app.get('/api/subforums/:categoryId', async (req, res) => {
  const data = await db.collection('subforums')
    .find({ categoryId: req.params.categoryId.toString() })
    .toArray();

  res.json(data);
});

// =========================
// THREADS (SORT BY LAST ACTIVITY 🔥)
// =========================
app.get('/api/threads/:subforumId', async (req, res) => {
  const data = await db.collection('threads')
    .find({ subforumId: req.params.subforumId })
    .sort({ lastActivity: -1 }) // 🔥 THIS IS THE KEY CHANGE
    .toArray();

  res.json(data);
});

app.post('/api/threads', async (req, res) => {
  const { title, subforumId, author } = req.body;

  if (!title || !subforumId || !author) {
    return res.status(400).send("Missing data");
  }

  const now = new Date();

 const thread = {
  title,
  subforumId,
  author,
  createdAt: now,
  lastActivity: now,
  replyCount: 0, // 🔥 NEW
  pinned: false,
  locked: false
};

  const result = await db.collection('threads').insertOne(thread);
  res.json({ ...thread, _id: result.insertedId });
});

// =========================
// POSTS (REPLIES)
// =========================
app.get('/api/posts/:threadId', async (req, res) => {
  const data = await db.collection('posts')
    .find({ threadId: req.params.threadId })
    .sort({ createdAt: 1 })
    .toArray();

  res.json(data);
});

app.post('/api/posts', async (req, res) => {
  const { threadId, text, author } = req.body;

  if (!threadId || !text || !author) {
    return res.status(400).send("Missing data");
  }

  const now = new Date();

  const post = {
    threadId,
    text,
    author,
    createdAt: now
  };

  const result = await db.collection('posts').insertOne(post);

  // 🔥 IMPORTANT: update thread activity
await db.collection('threads').updateOne(
  { _id: new ObjectId(threadId) },
  {
    $set: { lastActivity: now },
    $inc: { replyCount: 1 } // 🔥 NEW
  }
);

  res.json({ ...post, _id: result.insertedId });
});

// =========================
// SEED
// =========================
app.get('/api/seed', async (req, res) => {
  await db.collection('categories').deleteMany({});
  await db.collection('subforums').deleteMany({});

  const cat1 = await db.collection('categories').insertOne({ name: "General" });
  const cat2 = await db.collection('categories').insertOne({ name: "Defence" });

  await db.collection('subforums').insertMany([
    { name: "Announcements", categoryId: cat1.insertedId.toString() },
    { name: "Introductions", categoryId: cat1.insertedId.toString() },
    { name: "Military News", categoryId: cat2.insertedId.toString() }
  ]);

  res.send("Seeded categories + subforums");
});

// =========================
// START SERVER
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

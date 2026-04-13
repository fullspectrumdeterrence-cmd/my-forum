const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// DB CONNECTION
// =========================
const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("❌ MONGO_URI is missing in environment variables");
}

const client = new MongoClient(uri);

let db;

app.use(express.json());
app.use(express.static(__dirname));

// IMPORTANT: prevent crash if DB not ready
function safeDB() {
  if (!db) throw new Error("DB not connected yet");
  return db;
}

// =========================
// CONNECT TO MONGODB
// =========================
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
// INIT (TEMP FIX - VERY IMPORTANT)
// Creates starter categories if empty
// =========================
app.get('/api/init', async (req, res) => {
  const categories = await db.collection('categories').countDocuments();

  if (categories === 0) {
    await db.collection('categories').insertMany([
      { name: "Military Affairs" },
      { name: "Technology" },
      { name: "General Discussion" }
    ]);
  }

  res.send("init complete");
});


// =========================
// CATEGORIES
// =========================
app.get('/api/categories', async (req, res) => {
  try {
    const data = await db.collection('categories').find().toArray();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading categories");
  }
});

app.post('/api/categories', async (req, res) => {
  const result = await db.collection('categories').insertOne({
    name: req.body.name
  });

  res.json({ _id: result.insertedId, name: req.body.name });
});


// =========================
// SUBFORUMS
// =========================
app.get('/api/subforums/:categoryId', async (req, res) => {
  const data = await db.collection('subforums')
    .find({ categoryId: req.params.categoryId })
    .toArray();

  res.json(data);
});

app.post('/api/subforums', async (req, res) => {
  const result = await db.collection('subforums').insertOne({
    name: req.body.name,
    categoryId: req.body.categoryId
  });

  res.json({
    _id: result.insertedId,
    name: req.body.name,
    categoryId: req.body.categoryId
  });
});


// =========================
// THREADS
// =========================
app.get('/api/threads/:subforumId', async (req, res) => {
  const data = await db.collection('threads')
    .find({ subforumId: req.params.subforumId })
    .sort({ pinned: -1, createdAt: -1 })
    .toArray();

  res.json(data);
});

app.post('/api/threads', async (req, res) => {
  const thread = {
    title: req.body.title,
    subforumId: req.body.subforumId,
    author: req.body.author,
    createdAt: new Date(),
    pinned: false,
    locked: false
  };

  const result = await db.collection('threads').insertOne(thread);

  res.json({ ...thread, _id: result.insertedId });
});

app.put('/api/threads/:id/pin', async (req, res) => {
  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { pinned: true } }
  );
  res.json({ success: true });
});

app.put('/api/threads/:id/lock', async (req, res) => {
  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { locked: true } }
  );
  res.json({ success: true });
});

app.delete('/api/threads/:id', async (req, res) => {
  await db.collection('threads').deleteOne({
    _id: new ObjectId(req.params.id)
  });

  res.json({ success: true });
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

  const post = {
    threadId,
    text,
    author,
    createdAt: new Date()
  };

  const result = await db.collection('posts').insertOne(post);

  res.json({ ...post, _id: result.insertedId });
});

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
// START SERVER
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

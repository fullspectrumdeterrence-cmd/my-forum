const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// DB
// =========================
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db;

app.use(express.json());
app.use(express.static(__dirname));

async function connectDB() {
  await client.connect();
  db = client.db("forumDB");
  console.log("✅ MongoDB connected");
}
connectDB();


// =========================
// ROLES
// =========================
function canModerate(role) {
  return role === "admin" || role === "mod";
}


// =========================
// CATEGORIES
// =========================
app.get('/api/categories', async (req, res) => {
  res.json(await db.collection('categories').find().toArray());
});


// =========================
// SUBFORUMS
// =========================
app.get('/api/subforums/:categoryId', async (req, res) => {
  res.json(await db.collection('subforums')
    .find({ categoryId: req.params.categoryId.toString() })
    .toArray());
});


// =========================
// THREADS
// =========================
app.get('/api/threads/:subforumId', async (req, res) => {
  const threads = await db.collection('threads')
    .find({ subforumId: req.params.subforumId })
    .sort({ pinned: -1, lastActivity: -1 })
    .toArray();

  res.json(threads);
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
    replyCount: 0,
    lastPostAuthor: null,
    pinned: false,
    locked: false
  };

  const result = await db.collection('threads').insertOne(thread);
  res.json({ ...thread, _id: result.insertedId });
});


// =========================
// THREAD MODERATION
// =========================
app.put('/api/threads/:id/:action', async (req, res) => {
  const { role } = req.body;
  if (!canModerate(role)) return res.status(403).send("No permission");

  const id = new ObjectId(req.params.id);
  const action = req.params.action;

  const update = {};

  if (action === "pin") update.pinned = true;
  if (action === "unpin") update.pinned = false;
  if (action === "lock") update.locked = true;
  if (action === "unlock") update.locked = false;

  await db.collection('threads').updateOne(
    { _id: id },
    { $set: update }
  );

  res.json({ success: true });
});


// =========================
// POSTS
// =========================
app.get('/api/posts/:threadId', async (req, res) => {
  res.json(await db.collection('posts')
    .find({ threadId: req.params.threadId })
    .sort({ createdAt: 1 })
    .toArray());
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

  await db.collection('threads').updateOne(
    { _id: new ObjectId(threadId) },
    {
      $set: {
        lastActivity: now,
        lastPostAuthor: author
      },
      $inc: {
        replyCount: 1
      }
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
  await db.collection('threads').deleteMany({});
  await db.collection('posts').deleteMany({});

  const cat = await db.collection('categories').insertOne({ name: "General" });

  await db.collection('subforums').insertMany([
    { name: "Announcements", categoryId: cat.insertedId.toString() },
    { name: "Introductions", categoryId: cat.insertedId.toString() }
  ]);

  res.send("Seeded clean forum structure");
});


// =========================
// START
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

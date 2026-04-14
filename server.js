const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// DB CONNECTION
// =========================
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

app.use(express.json());
app.use(express.static(__dirname));

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
// ROLE HELPERS
// =========================
function canModerate(role) {
  return role === "admin" || role === "mod";
}


// =========================
// USERS (BASIC ROLE SYSTEM)
// =========================
app.get('/api/users', async (req, res) => {
  const users = await db.collection('users').find().toArray();
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { username, role } = req.body;

  if (!username) return res.status(400).send("Missing username");

  const user = {
    username,
    role: role || "user"
  };

  const result = await db.collection('users').insertOne(user);
  res.json({ ...user, _id: result.insertedId });
});


// =========================
// CATEGORIES
// =========================
app.get('/api/categories', async (req, res) => {
  const data = await db.collection('categories').find().toArray();
  res.json(data);
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
    .find({ categoryId: req.params.categoryId.toString() })
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
    .sort({ pinned: -1, lastActivity: -1, createdAt: -1 })
    .toArray();

  res.json(data);
});

app.post('/api/threads', async (req, res) => {
  const { title, subforumId, author, role } = req.body;

  if (!title || !subforumId || !author) {
    return res.status(400).send("Missing data");
  }

  const now = new Date();

  const thread = {
    title,
    subforumId,
    author,
    role: role || "user",
    createdAt: now,
    lastActivity: now,
    replyCount: 0,
    pinned: false,
    locked: false
  };

  const result = await db.collection('threads').insertOne(thread);
  res.json({ ...thread, _id: result.insertedId });
});


// =========================
// THREAD MODERATION
// =========================
app.put('/api/threads/:id/pin', async (req, res) => {
  if (!canModerate(req.body.role)) {
    return res.status(403).send("No permission");
  }

  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { pinned: true } }
  );

  res.json({ success: true });
});

app.put('/api/threads/:id/unpin', async (req, res) => {
  if (!canModerate(req.body.role)) {
    return res.status(403).send("No permission");
  }

  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { pinned: false } }
  );

  res.json({ success: true });
});

app.put('/api/threads/:id/lock', async (req, res) => {
  if (!canModerate(req.body.role)) {
    return res.status(403).send("No permission");
  }

  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { locked: true } }
  );

  res.json({ success: true });
});

app.put('/api/threads/:id/unlock', async (req, res) => {
  if (!canModerate(req.body.role)) {
    return res.status(403).send("No permission");
  }

  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { locked: false } }
  );

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
  try {
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

    // 🔥 XenForo-style thread bump
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

  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating post");
  }
});


// =========================
// SEED DATABASE
// =========================
app.get('/api/seed', async (req, res) => {
  await db.collection('categories').deleteMany({});
  await db.collection('subforums').deleteMany({});
  await db.collection('threads').deleteMany({});
  await db.collection('posts').deleteMany({});
  await db.collection('users').deleteMany({});

  const cat1 = await db.collection('categories').insertOne({ name: "General" });
  const cat2 = await db.collection('categories').insertOne({ name: "Defence" });

  await db.collection('subforums').insertMany([
    { name: "Announcements", categoryId: cat1.insertedId.toString() },
    { name: "Introductions", categoryId: cat1.insertedId.toString() },
    { name: "Military News", categoryId: cat2.insertedId.toString() }
  ]);

  res.send("Seeded forum with categories, subforums, threads, posts, users");
});


// =========================
// START SERVER
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

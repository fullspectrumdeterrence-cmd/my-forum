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

  res.json({ _id: result.insertedId, ...req.body });
});


// =========================
// THREADS
// =========================
app.get('/api/threads/:subforumId', async (req, res) => {
  const data = await db.collection('threads')
    .find({ subforumId: req.params.subforumId })
    .sort({ lastActivity: -1, createdAt: -1 })
    .toArray();

  res.json(data);
});

app.post('/api/threads', async (req, res) => {
  const now = new Date();

  const thread = {
    title: req.body.title,
    subforumId: req.body.subforumId,
    author: req.body.author,
    createdAt: now,
    lastActivity: now,
    replyCount: 0,
    pinned: false,
    locked: false
  };

  const result = await db.collection('threads').insertOne(thread);

  res.json({ ...thread, _id: result.insertedId });
});

app.put('/api/threads/:id', async (req, res) => {
  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { title: req.body.title } }
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
// POSTS
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
    const now = new Date();

    const post = {
      threadId: req.body.threadId,
      text: req.body.text,
      author: req.body.author,
      createdAt: now
    };

    const result = await db.collection('posts').insertOne(post);

    // update thread metadata
    await db.collection('threads').updateOne(
      { _id: new ObjectId(req.body.threadId) },
      {
        $set: { lastActivity: now },
        $inc: { replyCount: 1 }
      }
    );

    res.json({ ...post, _id: result.insertedId });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating post");
  }
});

app.put('/api/posts/:id', async (req, res) => {
  await db.collection('posts').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { text: req.body.text } }
  );

  res.json({ success: true });
});

app.delete('/api/posts/:id', async (req, res) => {
  await db.collection('posts').deleteOne({
    _id: new ObjectId(req.params.id)
  });

  res.json({ success: true });
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

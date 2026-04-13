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
  await client.connect();
  db = client.db("forumDB");
  console.log("✅ MongoDB connected");
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
    .sort({ createdAt: -1 })
    .toArray();

  res.json(data);
});

app.post('/api/threads', async (req, res) => {
  const thread = {
    title: req.body.title,
    subforumId: req.body.subforumId,
    author: req.body.author,
    createdAt: new Date()
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
  const post = {
    threadId: req.body.threadId,
    text: req.body.text,
    author: req.body.author,
    createdAt: new Date()
  };

  const result = await db.collection('posts').insertOne(post);

  res.json({ ...post, _id: result.insertedId });
});


// =========================
// START SERVER
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

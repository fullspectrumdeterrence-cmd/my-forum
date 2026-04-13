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
// GET POSTS
// =========================
app.get('/api/posts', async (req, res) => {
  const posts = await db.collection('posts').find().sort({ createdAt: -1 }).toArray();
  res.json(posts);
});


// =========================
// GET SINGLE POST
// =========================
app.get('/api/posts/:id', async (req, res) => {
  const post = await db.collection('posts').findOne({
    _id: new ObjectId(req.params.id)
  });

  res.json(post);
});


// =========================
// CREATE POST
// =========================
app.post('/api/posts', async (req, res) => {
  const { text, author, category } = req.body;

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
// UPDATE POST
// =========================
app.put('/api/posts/:id', async (req, res) => {
  await db.collection('posts').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { text: req.body.text } }
  );

  res.json({ success: true });
});


// =========================
// DELETE POST
// =========================
app.delete('/api/posts/:id', async (req, res) => {
  await db.collection('posts').deleteOne({
    _id: new ObjectId(req.params.id)
  });

  res.json({ success: true });
});


// =========================
// ADD REPLY
// =========================
app.post('/api/posts/:id/replies', async (req, res) => {
  const reply = {
    text: req.body.text,
    author: req.body.author,
    createdAt: new Date()
  };

  await db.collection('posts').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $push: { replies: reply } }
  );

  res.json(reply);
});


// =========================
// DELETE REPLY
// =========================
app.delete('/api/posts/:postId/replies/:replyIndex', async (req, res) => {
  const post = await db.collection('posts').findOne({
    _id: new ObjectId(req.params.postId)
  });

  post.replies.splice(req.params.replyIndex, 1);

  await db.collection('posts').updateOne(
    { _id: new ObjectId(req.params.postId) },
    { $set: { replies: post.replies } }
  );

  res.json({ success: true });
});


// =========================
// START SERVER
// =========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Running on port ${PORT}`);
});

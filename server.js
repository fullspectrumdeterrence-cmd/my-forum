const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// SECTION 1 - CONNECT DB
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
// SECTION 2 - CATEGORIES
// =========================

// 2.1 GET categories
app.get('/api/categories', async (req, res) => {
  const data = await db.collection('categories').find().toArray();
  res.json(data);
});

// 2.2 CREATE category
app.post('/api/categories', async (req, res) => {
  const result = await db.collection('categories').insertOne({
    name: req.body.name
  });

  res.json({ _id: result.insertedId, name: req.body.name });
});


// =========================
// SECTION 3 - SUBFORUMS
// =========================

// 3.1 GET subforums (WITH THREAD COUNT FIX)
app.get('/api/subforums/:categoryId', async (req, res) => {
  try {
    const subforums = await db.collection('subforums')
      .find({ categoryId: req.params.categoryId })
      .toArray();

    const threads = await db.collection('threads')
      .find()
      .toArray();

    const enriched = subforums.map(s => {
      const count = threads.filter(t =>
        t.subforumId === s._id.toString()
      ).length;

      return {
        ...s,
        threadCount: count
      };
    });

    res.json(enriched);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading subforums");
  }
});

// 3.2 CREATE subforum
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
// SECTION 4 - THREADS
// =========================

// 4.1 GET threads (sorted by activity)
app.get('/api/threads/:subforumId', async (req, res) => {
  const data = await db.collection('threads')
    .find({ subforumId: req.params.subforumId })
    .sort({ lastActivity: -1, createdAt: -1 })
    .toArray();

  res.json(data);
});

// 4.2 CREATE thread
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

// 4.3 EDIT thread
app.put('/api/threads/:id', async (req, res) => {
  try {
    await db.collection('threads').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title: req.body.title } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating thread");
  }
});

// 4.4 DELETE thread
app.delete('/api/threads/:id', async (req, res) => {
  try {
    await db.collection('threads').deleteOne({
      _id: new ObjectId(req.params.id)
    });

    await db.collection('posts').deleteMany({
      threadId: req.params.id
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting thread");
  }
});


// =========================
// SECTION 5 - POSTS
// =========================

// 5.1 GET posts
app.get('/api/posts/:threadId', async (req, res) => {
  const data = await db.collection('posts')
    .find({ threadId: req.params.threadId })
    .sort({ createdAt: 1 })
    .toArray();

  res.json(data);
});

// 5.2 CREATE post (with thread update)
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

// 5.3 EDIT post
app.put('/api/posts/:id', async (req, res) => {
  try {
    await db.collection('posts').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { text: req.body.text } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating post");
  }
});

// 5.4 DELETE post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    await db.collection('posts').deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting post");
  }
});


// =========================
// SECTION 6 - SEED
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
// SECTION 7 - START SERVER
// =========================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

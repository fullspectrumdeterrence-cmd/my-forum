// =====================================================
// SECTION 0 - IMPORTS
// =====================================================
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// SECTION 1 - MIDDLEWARE
// =====================================================

app.use(express.json());
app.use(express.static(__dirname));

// 1.1 - SESSION SETUP
app.use(session({
  secret: 'super-secret-key', // CHANGE IN PRODUCTION
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// =====================================================
// SECTION 2 - DATABASE CONNECTION
// =====================================================

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

// 2.1 CONNECT DB
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

// =====================================================
// SECTION 3 - AUTH (ADMIN SYSTEM)
// =====================================================

// 3.1 CREATE ADMIN (RUN ONCE ONLY)
app.get('/api/create-admin', async (req, res) => {
  const existing = await db.collection('users').findOne({ username: "admin" });

  if (existing) {
    return res.send("Admin already exists");
  }

  const hash = await bcrypt.hash("admin123", 10);

  await db.collection('users').insertOne({
    username: "admin",
    password: hash,
    role: "admin"
  });

  res.send("Admin created");
});

// 3.2 LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await db.collection('users').findOne({ username });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.user = {
    id: user._id,
    username: user.username,
    role: user.role
  };

  res.json({ success: true, role: user.role });
});

// 3.3 CURRENT USER
app.get('/api/me', (req, res) => {
  if (!req.session.user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    user: req.session.user
  });
});

// =====================================================
// SECTION 4 - CATEGORIES
// =====================================================

// 4.1 GET categories
app.get('/api/categories', async (req, res) => {
  const data = await db.collection('categories').find().toArray();
  res.json(data);
});

// 4.2 CREATE category
app.post('/api/categories', async (req, res) => {
  const result = await db.collection('categories').insertOne({
    name: req.body.name
  });

  res.json({
    _id: result.insertedId,
    name: req.body.name
  });
});

// =====================================================
// SECTION 5 - SUBFORUMS
// =====================================================

// 5.1 GET subforums
app.get('/api/subforums/:categoryId', async (req, res) => {
  try {
    const subforums = await db.collection('subforums')
      .find({ categoryId: req.params.categoryId })
      .toArray();

    const threads = await db.collection('threads').find().toArray();

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

// 5.2 CREATE subforum
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

// =====================================================
// SECTION 6 - THREADS
// =====================================================

// 6.1 GET threads
app.get('/api/threads/:subforumId', async (req, res) => {
  const data = await db.collection('threads')
    .find({ subforumId: req.params.subforumId })
    .sort({ lastActivity: -1, createdAt: -1 })
    .toArray();

  res.json(data);
});

// 6.2 CREATE thread
app.post('/api/threads', async (req, res) => {
  const now = new Date();

  const thread = {
    title: req.body.title,
    subforumId: req.body.subforumId,
    author: req.body.author,
    createdAt: now,
    lastActivity: now,
    replyCount: 0
  };

  const result = await db.collection('threads').insertOne(thread);

  res.json({ ...thread, _id: result.insertedId });
});

// 6.3 EDIT thread
app.put('/api/threads/:id', async (req, res) => {
  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { title: req.body.title } }
  );

  res.json({ success: true });
});

// 6.4 DELETE thread
app.delete('/api/threads/:id', async (req, res) => {
  await db.collection('threads').deleteOne({
    _id: new ObjectId(req.params.id)
  });

  await db.collection('posts').deleteMany({
    threadId: req.params.id
  });

  res.json({ success: true });
});

// =====================================================
// SECTION 7 - POSTS
// =====================================================

// 7.1 GET posts
app.get('/api/posts/:threadId', async (req, res) => {
  const data = await db.collection('posts')
    .find({ threadId: req.params.threadId })
    .sort({ createdAt: 1 })
    .toArray();

  res.json(data);
});

// 7.2 CREATE post
app.post('/api/posts', async (req, res) => {
  const now = new Date();

  const post = {
    threadId: req.body.threadId,
    text: req.body.text,
    author: req.body.author,
    createdAt: now
  };

  const result = await db.collection('posts').insertOne(post);

  await db.collection('threads').updateOne(
    { _id: new ObjectId(req.body.threadId) },
    {
      $set: { lastActivity: now },
      $inc: { replyCount: 1 }
    }
  );

  res.json({ ...post, _id: result.insertedId });
});

// 7.3 EDIT post
app.put('/api/posts/:id', async (req, res) => {
  await db.collection('posts').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { text: req.body.text } }
  );

  res.json({ success: true });
});

// 7.4 DELETE post
app.delete('/api/posts/:id', async (req, res) => {
  await db.collection('posts').deleteOne({
    _id: new ObjectId(req.params.id)
  });

  res.json({ success: true });
});

// =====================================================
// SECTION 8 - START SERVER
// =====================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

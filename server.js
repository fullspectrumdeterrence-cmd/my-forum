// =========================
// THREADS
// =========================

// GET threads in a subforum
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
// POSTS (REPLIES)
// =========================

// GET posts in thread
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


// ADD post (reply)
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

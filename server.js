const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Secure session setup
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // change to true if using HTTPS!
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 // 1 hour
  }
}));

// Middleware to parse JSON request bodies:
app.use(express.json()); // <-- This is crucial

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/data', express.static('data'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate-limiting middleware for login route
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

// Load users
const usersFilePath = path.join(__dirname, 'users.json');
let users = [];

if (fs.existsSync(usersFilePath)) {
  users = JSON.parse(fs.readFileSync(usersFilePath));
}

// Setup file upload directory with multer
const upload = multer({ dest: 'uploads/' });

// Redirect root to /login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Home route with login check
app.get('/home', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'static', 'home.html'));
  } else {
    res.redirect('/login');
  }
});

app.get('/standby', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'static', 'standbyclock.html'));
  } else {
    res.redirect('/login');
  }
});

app.get('/main', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'static', 'main.html'));
  } else {
    res.redirect('/login');
  }
});

app.get('/flashcards', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'static', 'flashcards.html'));
  } else {
    res.redirect('/login');
  }
});

app.get('/lexipractice', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'static', 'LexiPractice.html'));
  } else {
    res.redirect('/login');
  }
});

app.get('/lexicon-mastery', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'static', 'Lexicon Mastery.html'));
  } else {
    res.redirect('/login');
  }
});

// Serve combined login/signup page for both routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'static', 'loginsignup.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'static', 'loginsignup.html'));
});

// Login post with rate limiting
app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(user => user.username === username);

  if (!user || !user.password) {
    return res.send('Invalid login. <a href="/login">Try again</a>');
  }

  const match = await bcrypt.compare(password, user.password);
  if (match) {
    req.session.loggedIn = true;
    req.session.username = username;
    res.redirect('/home');
  } else {
    res.send('Invalid password. <a href="/login">Try again</a>');
  }
});

// Signup post
app.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;

  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.send('User already exists. <a href="/signup">Try again</a>');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ id: uuidv4(), username, email: email || '', password: hashedPassword });

  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
  res.send('Signup successful! <a href="/login">Login here</a>');
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.send('Error logging out');
    }
    res.redirect('/login');
  });
});

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

app.get('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  const file = path.join(dataDir, `${key}.json`);
  if (!fs.existsSync(file)) return res.json(null);
  try {
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'read_failed' });
  }
});

app.post('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  const file = path.join(dataDir, `${key}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'write_failed' });
  }
});

app.delete('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  const file = path.join(dataDir, `${key}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// Start server — bind to all interfaces so other devices on the LAN can reach it
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT} — access via http://<machine-ip>:${PORT}`);
});

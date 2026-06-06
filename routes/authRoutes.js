const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

const USERS = './data/users.json';
const read  = f => JSON.parse(fs.readFileSync(f));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.redirect(req.session.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
});

router.get('/login',    (req, res) => res.render('login',    { error: null }));
router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = read(USERS);
  const user  = users.find(u => u.username === username && u.password === password);
  if (!user) return res.render('login', { error: 'Invalid username or password.' });
  req.session.user = user;
  res.redirect(user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
});

router.post('/register', (req, res) => {
  const { name, username, password } = req.body;
  const users = read(USERS);
  if (users.find(u => u.username === username))
    return res.render('register', { error: 'Username already taken. Choose another.' });
  const newUser = { id: uuidv4(), name, username, password, role: 'student' };
  users.push(newUser);
  write(USERS, users);
  res.redirect('/login');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Customer self-registration
router.post('/register', async (req, res) => {
  const { name, email, password, address, phone } = req.body;
  if (!name || !email || !password || !address) {
    return res.status(400).json({ message: 'name, email, password and address are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 10);
    const u = await client.query(
      `INSERT INTO users (name,email,password_hash,role)
       VALUES ($1,$2,$3,'CUSTOMER') RETURNING id`,
      [name, email.toLowerCase(), hash]);
    await client.query(
      'INSERT INTO customers (user_id,name,address,phone) VALUES ($1,$2,$3,$4)',
      [u.rows[0].id, name, address, phone || null]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Registered successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ message: 'Email already registered' });
    res.status(500).json({ message: 'Registration failed' });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  try {
    const r = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    res.status(500).json({ message: 'Login failed' });
  }
});

router.get('/me', authenticate, (req, res) => res.json(req.user));

module.exports = router;

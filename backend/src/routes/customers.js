const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

router.get('/me', authorize('CUSTOMER'), async (req, res) => {
  try {
    const c = await pool.query('SELECT * FROM customers WHERE user_id = $1', [req.user.id]);
    if (!c.rows[0]) return res.status(404).json({ message: 'Customer profile not found' });
    const m = await pool.query('SELECT * FROM meters WHERE customer_id = $1', [c.rows[0].id]);
    res.json({ ...c.rows[0], meters: m.rows });
  } catch {
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

router.get('/', authorize('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, u.email, COALESCE(string_agg(m.meter_number, ', '), '') AS meters
       FROM customers c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN meters m ON m.customer_id = c.id
       GROUP BY c.id, u.email
       ORDER BY c.id`
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load customers' });
  }
});

router.post('/', authorize('ADMIN', 'STAFF'), async (req, res) => {
  const { name, address, phone, connection_type, meter_number, email, password } = req.body;
  if (!name || !address) {
    return res.status(400).json({ message: 'name and address are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let userId = null;
    if (email && password) {
      const hash = await bcrypt.hash(password, 10);
      const u = await client.query(
        `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'CUSTOMER') RETURNING id`,
        [name, email.toLowerCase(), hash]
      );
      userId = u.rows[0].id;
    }
    const c = await client.query(
      `INSERT INTO customers (user_id,name,address,phone,connection_type) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, name, address, phone || null, connection_type || 'DOMESTIC']
    );
    if (meter_number) {
      await client.query('INSERT INTO meters (customer_id, meter_number) VALUES ($1,$2)', [c.rows[0].id, meter_number]);
    }
    await client.query('COMMIT');
    res.status(201).json(c.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ message: 'Email or meter number already exists' });
    res.status(500).json({ message: 'Failed to create customer' });
  } finally {
    client.release();
  }
});

router.put('/:id', authorize('ADMIN', 'STAFF'), async (req, res) => {
  const { name, address, phone, connection_type } = req.body;
  try {
    const r = await pool.query(
      `UPDATE customers SET name = COALESCE($1,name), address = COALESCE($2,address), phone = COALESCE($3,phone), connection_type = COALESCE($4,connection_type) WHERE id = $5 RETURNING *`,
      [name, address, phone, connection_type, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'Customer not found' });
    res.json(r.rows[0]);
  } catch {
    res.status(500).json({ message: 'Failed to update customer' });
  }
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ message: 'Customer has bills and cannot be deleted' });
    res.status(500).json({ message: 'Failed to delete customer' });
  }
});

module.exports = router;

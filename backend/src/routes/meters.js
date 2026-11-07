const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'STAFF', 'METER_READER'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT m.*, c.name AS customer_name, c.address,
              (SELECT reading_value FROM readings r WHERE r.meter_id = m.id ORDER BY reading_date DESC LIMIT 1) AS last_reading_value,
              (SELECT reading_date FROM readings r WHERE r.meter_id = m.id ORDER BY reading_date DESC LIMIT 1) AS last_reading_date
       FROM meters m JOIN customers c ON c.id = m.customer_id ORDER BY m.id`
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load meters' });
  }
});

router.post('/', authorize('ADMIN', 'STAFF'), async (req, res) => {
  const { customer_id, meter_number } = req.body;
  if (!customer_id || !meter_number) return res.status(400).json({ message: 'customer_id and meter_number are required' });
  try {
    const r = await pool.query('INSERT INTO meters (customer_id, meter_number) VALUES ($1,$2) RETURNING *', [customer_id, meter_number]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'Meter number already exists' });
    if (e.code === '23503') return res.status(404).json({ message: 'Customer not found' });
    res.status(500).json({ message: 'Failed to create meter' });
  }
});

router.patch('/:id/status', authorize('ADMIN', 'STAFF'), async (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ message: 'status must be ACTIVE or INACTIVE' });
  try {
    const r = await pool.query('UPDATE meters SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ message: 'Meter not found' });
    res.json(r.rows[0]);
  } catch {
    res.status(500).json({ message: 'Failed to update meter' });
  }
});

module.exports = router;

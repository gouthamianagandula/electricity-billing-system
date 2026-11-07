const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'STAFF', 'METER_READER'), async (req, res) => {
  const { meter_id } = req.query;
  try {
    const r = await pool.query(
      `SELECT r.*, m.meter_number, c.name AS customer_name
       FROM readings r JOIN meters m ON m.id = r.meter_id JOIN customers c ON c.id = m.customer_id
       WHERE ($1::int IS NULL OR r.meter_id = $1::int)
       ORDER BY r.reading_date DESC, r.id DESC LIMIT 200`,
      [meter_id || null]
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load readings' });
  }
});

router.post('/', authorize('METER_READER', 'ADMIN', 'STAFF'), async (req, res) => {
  const { meter_id, reading_date, reading_value } = req.body;
  if (!meter_id || !reading_date || reading_value === undefined || reading_value === '') {
    return res.status(400).json({ message: 'meter_id, reading_date and reading_value are required' });
  }
  const value = Number(reading_value);
  if (Number.isNaN(value) || value < 0) return res.status(400).json({ message: 'reading_value must be a positive number' });

  try {
    const meter = await pool.query('SELECT id, status FROM meters WHERE id = $1', [meter_id]);
    if (!meter.rows[0]) return res.status(404).json({ message: 'Meter not found' });
    if (meter.rows[0].status !== 'ACTIVE') return res.status(400).json({ message: 'Meter is inactive' });

    const prev = await pool.query('SELECT reading_value, reading_date FROM readings WHERE meter_id = $1 ORDER BY reading_date DESC LIMIT 1', [meter_id]);
    let units = 0;
    if (prev.rows[0]) {
      if (new Date(reading_date) <= new Date(prev.rows[0].reading_date)) {
        return res.status(400).json({ message: 'Reading date must be after the last reading date' });
      }
      const prevValue = Number(prev.rows[0].reading_value);
      if (value < prevValue) {
        return res.status(400).json({ message: `Reading cannot be less than the previous reading (${prevValue})` });
      }
      units = Math.round((value - prevValue) * 100) / 100;
    }
    const r = await pool.query(
      `INSERT INTO readings (meter_id, reading_date, reading_value, units_consumed, recorded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [meter_id, reading_date, value, units, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'A reading already exists for this date' });
    res.status(500).json({ message: 'Failed to save reading' });
  }
});

module.exports = router;

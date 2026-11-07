const express = require('express');
const pool = require('../db');
const { calculateBill } = require('../services/billing');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const BILL_SELECT = `SELECT b.*, c.name AS customer_name, c.address, m.meter_number
  FROM bills b
  JOIN customers c ON c.id = b.customer_id
  JOIN meters m ON m.id = b.meter_id`;

async function markOverdue() {
  await pool.query(
    `UPDATE bills SET status = 'OVERDUE' WHERE status = 'UNPAID' AND due_date < CURRENT_DATE`);
}

async function ownCustomerId(userId) {
  const r = await pool.query('SELECT id FROM customers WHERE user_id = $1', [userId]);
  return r.rows[0] ? r.rows[0].id : null;
}

// List bills. Customers only see their own.
router.get('/', authorize('ADMIN', 'STAFF', 'CUSTOMER'), async (req, res) => {
  try {
    await markOverdue();
    const params = [];
    const where = [];
    if (req.user.role === 'CUSTOMER') {
      params.push((await ownCustomerId(req.user.id)) || 0);
      where.push(`b.customer_id = $${params.length}`);
    } else if (req.query.customer_id) {
      params.push(req.query.customer_id);
      where.push(`b.customer_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status.toUpperCase());
      where.push(`b.status = $${params.length}`);
    }
    const sql = `${BILL_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY b.billing_month DESC, b.id DESC`;
    res.json((await pool.query(sql, params)).rows);
  } catch {
    res.status(500).json({ message: 'Failed to load bills' });
  }
});

// Readings that have consumption but no bill yet (staff picks one to generate)
router.get('/ungenerated', authorize('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.id AS reading_id, r.reading_date, r.units_consumed,
              m.meter_number, c.name AS customer_name
       FROM readings r
       JOIN meters m ON m.id = r.meter_id
       JOIN customers c ON c.id = m.customer_id
       WHERE r.units_consumed > 0
         AND NOT EXISTS (
           SELECT 1 FROM bills b
           WHERE b.meter_id = r.meter_id
             AND b.billing_month = date_trunc('month', r.reading_date)::date)
       ORDER BY r.reading_date DESC`);
    res.json(r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load readings' });
  }
});

// Generate a bill from a reading using the slab tariffs + fixed charge
router.post('/generate', authorize('ADMIN', 'STAFF'), async (req, res) => {
  const { reading_id } = req.body;
  if (!reading_id) return res.status(400).json({ message: 'reading_id is required' });
  try {
    const r = await pool.query(
      `SELECT r.id, r.meter_id, r.units_consumed, r.reading_date, m.customer_id,
              to_char(date_trunc('month', r.reading_date), 'YYYY-MM-DD') AS billing_month
       FROM readings r JOIN meters m ON m.id = r.meter_id
       WHERE r.id = $1`, [reading_id]);
    const rd = r.rows[0];
    if (!rd) return res.status(404).json({ message: 'Reading not found' });
    const units = Number(rd.units_consumed);
    if (units <= 0) return res.status(400).json({ message: 'No consumption for this reading' });

    const tariffs = (await pool.query('SELECT * FROM tariffs ORDER BY slab_from')).rows;
    const { energy, fixed, total } = calculateBill(units, tariffs, process.env.FIXED_CHARGE || 50);

    const ins = await pool.query(
      `INSERT INTO bills (customer_id, meter_id, reading_id, billing_month, units,
         energy_charge, fixed_charge, total_amount, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date + 15) RETURNING *`,
      [rd.customer_id, rd.meter_id, rd.id, rd.billing_month, units, energy, fixed, total, rd.reading_date]);
    res.status(201).json(ins.rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ message: 'A bill already exists for this meter and month' });
    }
    res.status(500).json({ message: 'Failed to generate bill' });
  }
});

router.get('/:id', authorize('ADMIN', 'STAFF', 'CUSTOMER'), async (req, res) => {
  try {
    await markOverdue();
    const r = await pool.query(`${BILL_SELECT} WHERE b.id = $1`, [req.params.id]);
    const bill = r.rows[0];
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (req.user.role === 'CUSTOMER' && bill.customer_id !== (await ownCustomerId(req.user.id))) {
      return res.status(403).json({ message: 'You do not have access to this' });
    }
    res.json(bill);
  } catch {
    res.status(500).json({ message: 'Failed to load bill' });
  }
});

module.exports = router;

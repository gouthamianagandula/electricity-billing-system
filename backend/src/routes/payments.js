const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Simulated payment: marks the bill PAID and stores a transaction id
router.post('/', authorize('CUSTOMER', 'ADMIN', 'STAFF'), async (req, res) => {
  const { bill_id } = req.body;
  const method = (req.body.method || 'UPI').toUpperCase();
  if (!bill_id) return res.status(400).json({ message: 'bill_id is required' });
  if (!['UPI', 'CARD', 'NETBANKING'].includes(method)) {
    return res.status(400).json({ message: 'method must be UPI, CARD or NETBANKING' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query('SELECT * FROM bills WHERE id = $1 FOR UPDATE', [bill_id]);
    const bill = b.rows[0];
    if (!bill) throw new HttpError(404, 'Bill not found');
    if (req.user.role === 'CUSTOMER') {
      const c = await client.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!c.rows[0] || c.rows[0].id !== bill.customer_id) {
        throw new HttpError(403, 'You do not have access to this');
      }
    }
    if (bill.status === 'PAID') throw new HttpError(409, 'Bill is already paid');

    const txn = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const p = await client.query(
      `INSERT INTO payments (bill_id, amount, transaction_id, method)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [bill.id, bill.total_amount, txn, method]);
    await client.query(`UPDATE bills SET status = 'PAID' WHERE id = $1`, [bill.id]);
    await client.query('COMMIT');
    res.status(201).json(p.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });
    res.status(500).json({ message: 'Payment failed' });
  } finally {
    client.release();
  }
});

// Payment history (customers see only their own)
router.get('/', authorize('CUSTOMER', 'ADMIN', 'STAFF'), async (req, res) => {
  try {
    const params = [];
    let where = '';
    if (req.user.role === 'CUSTOMER') {
      params.push(req.user.id);
      where = 'WHERE c.user_id = $1';
    }
    const r = await pool.query(
      `SELECT p.*, b.billing_month, c.name AS customer_name, m.meter_number
       FROM payments p
       JOIN bills b ON b.id = p.bill_id
       JOIN customers c ON c.id = b.customer_id
       JOIN meters m ON m.id = b.meter_id
       ${where}
       ORDER BY p.payment_date DESC`, params);
    res.json(r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load payments' });
  }
});

module.exports = router;

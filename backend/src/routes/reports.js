const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'STAFF'));

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function send(req, res, name, rows) {
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${name}.csv`);
    return res.send(toCsv(rows));
  }
  res.json(rows);
}

// 1. Monthly consumption
router.get('/monthly-consumption', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT to_char(reading_date, 'YYYY-MM') AS month,
              SUM(units_consumed) AS total_units,
              ROUND(AVG(units_consumed), 2) AS avg_units_per_meter,
              COUNT(*) AS readings
       FROM readings
       WHERE units_consumed > 0
       GROUP BY 1 ORDER BY 1 DESC`);
    send(req, res, 'monthly-consumption', r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load report' });
  }
});

// 2. Customer billing (filters: month=YYYY-MM, customer_id)
router.get('/customer-billing', async (req, res) => {
  try {
    const params = [];
    const where = [];
    if (req.query.month) {
      params.push(req.query.month);
      where.push(`to_char(b.billing_month, 'YYYY-MM') = $${params.length}`);
    }
    if (req.query.customer_id) {
      params.push(req.query.customer_id);
      where.push(`b.customer_id = $${params.length}`);
    }
    const r = await pool.query(
      `SELECT c.name AS customer, m.meter_number,
              to_char(b.billing_month, 'YYYY-MM') AS month, b.units,
              b.energy_charge, b.fixed_charge, b.total_amount, b.due_date, b.status
       FROM bills b
       JOIN customers c ON c.id = b.customer_id
       JOIN meters m ON m.id = b.meter_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY b.billing_month DESC, c.name`, params);
    send(req, res, 'customer-billing', r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load report' });
  }
});

// 3. Payment status (filter: status=PAID|UNPAID|OVERDUE)
router.get('/payment-status', async (req, res) => {
  try {
    await pool.query(
      `UPDATE bills SET status = 'OVERDUE' WHERE status = 'UNPAID' AND due_date < CURRENT_DATE`);
    const params = [];
    let where = '';
    if (req.query.status) {
      params.push(req.query.status.toUpperCase());
      where = 'WHERE b.status = $1';
    }
    const r = await pool.query(
      `SELECT c.name AS customer, to_char(b.billing_month, 'YYYY-MM') AS month,
              b.total_amount, b.due_date, b.status,
              p.payment_date AS paid_on, p.transaction_id
       FROM bills b
       JOIN customers c ON c.id = b.customer_id
       LEFT JOIN payments p ON p.bill_id = b.id
       ${where}
       ORDER BY b.status, b.due_date DESC`, params);
    send(req, res, 'payment-status', r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load report' });
  }
});

// 4. High consumption: usage above threshold x the meter's average (default 1.5)
router.get('/high-consumption', async (req, res) => {
  const threshold = Number(req.query.threshold) || 1.5;
  try {
    const r = await pool.query(
      `WITH x AS (
         SELECT r.*,
                (SUM(units_consumed) OVER (PARTITION BY meter_id) - units_consumed)
                  / NULLIF(COUNT(*) OVER (PARTITION BY meter_id) - 1, 0) AS avg_others
         FROM readings r
         WHERE units_consumed > 0)
       SELECT c.name AS customer, m.meter_number,
              to_char(x.reading_date, 'YYYY-MM') AS month,
              x.units_consumed AS units,
              ROUND(x.avg_others, 2) AS usual_avg,
              ROUND(x.units_consumed / x.avg_others, 2) AS times_average
       FROM x
       JOIN meters m ON m.id = x.meter_id
       JOIN customers c ON c.id = m.customer_id
       WHERE x.avg_others IS NOT NULL AND x.units_consumed > $1 * x.avg_others
       ORDER BY times_average DESC`, [threshold]);
    send(req, res, 'high-consumption', r.rows);
  } catch {
    res.status(500).json({ message: 'Failed to load report' });
  }
});

module.exports = router;

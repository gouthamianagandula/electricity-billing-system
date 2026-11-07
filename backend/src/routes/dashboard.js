const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    await pool.query(
      `UPDATE bills SET status = 'OVERDUE' WHERE status = 'UNPAID' AND due_date < CURRENT_DATE`);
    const role = req.user.role;

    if (role === 'ADMIN' || role === 'STAFF') {
      const [cards, consumption, billing, statuses, topUsers] = await Promise.all([
        pool.query(`SELECT
          (SELECT COUNT(*) FROM customers)::int AS customers,
          (SELECT COUNT(*) FROM meters WHERE status = 'ACTIVE')::int AS active_meters,
          (SELECT COALESCE(SUM(amount), 0) FROM payments)::float8 AS revenue_collected,
          (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE status <> 'PAID')::float8 AS pending_amount,
          (SELECT COUNT(*) FROM bills WHERE status = 'OVERDUE')::int AS overdue_bills,
          (SELECT COUNT(*) FROM readings r
             WHERE r.units_consumed > 0 AND NOT EXISTS (
               SELECT 1 FROM bills b WHERE b.meter_id = r.meter_id
                 AND b.billing_month = date_trunc('month', r.reading_date)::date))::int AS bills_to_generate`),
        pool.query(`SELECT to_char(reading_date, 'YYYY-MM') AS month,
                           SUM(units_consumed)::float8 AS units
                    FROM readings
                    WHERE reading_date >= date_trunc('month', CURRENT_DATE) - interval '5 months'
                    GROUP BY 1 ORDER BY 1`),
        pool.query(`SELECT * FROM (
                      SELECT to_char(billing_month, 'YYYY-MM') AS month,
                             SUM(total_amount)::float8 AS billed,
                             COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'), 0)::float8 AS collected
                      FROM bills GROUP BY 1 ORDER BY 1 DESC LIMIT 6) t
                    ORDER BY month`),
        pool.query(`SELECT status, COUNT(*)::int AS count FROM bills GROUP BY status`),
        pool.query(`SELECT c.name, SUM(r.units_consumed)::float8 AS units
                    FROM readings r JOIN meters m ON m.id = r.meter_id
                    JOIN customers c ON c.id = m.customer_id
                    WHERE r.reading_date >= date_trunc('month', CURRENT_DATE) - interval '5 months'
                    GROUP BY c.name ORDER BY units DESC LIMIT 5`),
      ]);
      return res.json({
        role,
        cards: cards.rows[0],
        monthlyConsumption: consumption.rows,
        billedVsCollected: billing.rows,
        billStatus: statuses.rows,
        topConsumers: topUsers.rows,
      });
    }

    if (role === 'METER_READER') {
      const [cards, pending, recent] = await Promise.all([
        pool.query(`SELECT
          (SELECT COUNT(*) FROM meters WHERE status = 'ACTIVE')::int AS active_meters,
          (SELECT COUNT(DISTINCT meter_id) FROM readings
             WHERE date_trunc('month', reading_date) = date_trunc('month', CURRENT_DATE))::int AS read_this_month,
          (SELECT COUNT(*) FROM readings WHERE recorded_by = $1)::int AS my_readings`, [req.user.id]),
        pool.query(`SELECT m.id, m.meter_number, c.name AS customer_name, c.address
                    FROM meters m JOIN customers c ON c.id = m.customer_id
                    WHERE m.status = 'ACTIVE' AND NOT EXISTS (
                      SELECT 1 FROM readings r WHERE r.meter_id = m.id
                        AND date_trunc('month', r.reading_date) = date_trunc('month', CURRENT_DATE))
                    ORDER BY m.id`),
        pool.query(`SELECT r.reading_date, r.reading_value, r.units_consumed, m.meter_number
                    FROM readings r JOIN meters m ON m.id = r.meter_id
                    WHERE r.recorded_by = $1
                    ORDER BY r.reading_date DESC, r.id DESC LIMIT 10`, [req.user.id]),
      ]);
      const c = cards.rows[0];
      return res.json({
        role,
        cards: { ...c, pending_this_month: c.active_meters - c.read_this_month },
        pendingMeters: pending.rows,
        recentReadings: recent.rows,
      });
    }

    // CUSTOMER
    const cust = await pool.query('SELECT id, name FROM customers WHERE user_id = $1', [req.user.id]);
    if (!cust.rows[0]) return res.status(404).json({ message: 'Customer profile not found' });
    const cid = cust.rows[0].id;
    const [due, totals, trend] = await Promise.all([
      pool.query(`SELECT id, billing_month, units, total_amount::float8 AS total_amount, due_date, status
                  FROM bills WHERE customer_id = $1 AND status <> 'PAID'
                  ORDER BY due_date LIMIT 1`, [cid]),
      pool.query(`SELECT
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'), 0)::float8 AS total_paid,
          COALESCE(SUM(total_amount) FILTER (WHERE status <> 'PAID'), 0)::float8 AS total_due,
          COALESCE(ROUND(AVG(units), 1), 0)::float8 AS avg_units,
          COUNT(*) FILTER (WHERE status = 'OVERDUE')::int AS overdue_bills
        FROM bills WHERE customer_id = $1`, [cid]),
      pool.query(`SELECT * FROM (
                    SELECT to_char(billing_month, 'YYYY-MM') AS month, units::float8 AS units,
                           total_amount::float8 AS amount, status, due_date
                    FROM bills WHERE customer_id = $1
                    ORDER BY billing_month DESC LIMIT 12) t
                  ORDER BY month`, [cid]),
    ]);
    const last = trend.rows[trend.rows.length - 1];
    res.json({
      role,
      customer: cust.rows[0].name,
      cards: { ...totals.rows[0], last_month_units: last ? last.units : 0 },
      nextDue: due.rows[0] || null,
      trend: trend.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
});

module.exports = router;

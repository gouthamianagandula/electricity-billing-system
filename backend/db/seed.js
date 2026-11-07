require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const { calculateBill } = require('../src/services/billing');

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const customers = [
  { name: 'Ravi Kumar',   address: 'H.No 1-23, Hanamkonda', phone: '9000000001', base: 90 },
  { name: 'Sita Devi',    address: 'H.No 4-56, Warangal',   phone: '9000000002', base: 150 },
  { name: 'Arjun Reddy',  address: 'H.No 7-89, Kazipet',    phone: '9000000003', base: 220, overdue: true },
  { name: 'Meena Sharma', address: 'H.No 2-10, Subedari',   phone: '9000000004', base: 120 },
  { name: 'Kiran Rao',    address: 'H.No 9-45, Nakkalagutta', phone: '9000000005', base: 260, spike: true },
];

async function seed() {
  const hash = await bcrypt.hash('password123', 10);
  await pool.query('TRUNCATE payments, bills, readings, meters, customers, users RESTART IDENTITY CASCADE');

  const addUser = async (name, email, role) =>
    (await pool.query(
      'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, email, hash, role])).rows[0].id;

  await addUser('Admin User', 'admin@demo.com', 'ADMIN');
  await addUser('Staff User', 'staff@demo.com', 'STAFF');
  const readerId = await addUser('Meter Reader', 'reader@demo.com', 'METER_READER');

  const tariffs = (await pool.query('SELECT * FROM tariffs ORDER BY slab_from')).rows;
  const fixed = Number(process.env.FIXED_CHARGE || 50);
  const now = new Date();

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const userId = await addUser(c.name, `customer${i + 1}@demo.com`, 'CUSTOMER');
    const custId = (await pool.query(
      'INSERT INTO customers (user_id,name,address,phone) VALUES ($1,$2,$3,$4) RETURNING id',
      [userId, c.name, c.address, c.phone])).rows[0].id;
    const meterId = (await pool.query(
      'INSERT INTO meters (customer_id,meter_number) VALUES ($1,$2) RETURNING id',
      [custId, `MTR-${1001 + i}`])).rows[0].id;

    let reading = 1000;
    for (let m = 6; m >= 0; m--) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, 1);
      let units = m === 6 ? 0 : c.base + Math.floor(Math.random() * 31) - 15;
      if (c.spike && m === 0) units += 150;
      reading += units;

      const readingId = (await pool.query(
        `INSERT INTO readings (meter_id,reading_date,reading_value,units_consumed,recorded_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [meterId, fmt(date), reading, units, readerId])).rows[0].id;

      if (units > 0) {
        const { energy, total } = calculateBill(units, tariffs, fixed);
        const due = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 20);
        const paid = m >= 1 && !(c.overdue && m === 1);
        const billId = (await pool.query(
          `INSERT INTO bills (customer_id,meter_id,reading_id,billing_month,units,
             energy_charge,fixed_charge,total_amount,due_date,status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [custId, meterId, readingId, fmt(date), units, energy, fixed, total,
           fmt(due), paid ? 'PAID' : 'UNPAID'])).rows[0].id;

        if (paid) {
          await pool.query(
            'INSERT INTO payments (bill_id,amount,transaction_id,method) VALUES ($1,$2,$3,$4)',
            [billId, total, `TXN${Date.now()}${Math.floor(Math.random() * 100000)}`, 'UPI']);
        }
      }
    }
  }
}

seed()
  .then(() => { console.log('Seed complete'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
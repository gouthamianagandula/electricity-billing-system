import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';

const label = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const isMoney = (k) => /amount|revenue|paid|due$/.test(k);
const rupee = (v) => '\u20B9' + Number(v).toLocaleString('en-IN');
const STATUS_COLORS = { PAID: '#16a34a', UNPAID: '#eab308', OVERDUE: '#dc2626' };

function Cards({ cards }) {
  return (
    <div className="cards">
      {Object.entries(cards).map(([k, v]) => (
        <div className="stat" key={k}>
          <div className="stat-label">{label(k)}</div>
          <div className="stat-value">{isMoney(k) ? rupee(v) : v}</div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <h3 className="chart-title">{title}</h3>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function AdminView({ d }) {
  return (
    <>
      <Cards cards={d.cards} />
      <div className="charts">
        <ChartCard title="Monthly consumption (units)">
          <BarChart data={d.monthlyConsumption}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" /><YAxis /><Tooltip />
            <Bar dataKey="units" fill="#1d4ed8" name="Units" />
          </BarChart>
        </ChartCard>
        <ChartCard title="Billed vs collected">
          <BarChart data={d.billedVsCollected}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => rupee(v)} /><Legend />
            <Bar dataKey="billed" fill="#94a3b8" name="Billed" />
            <Bar dataKey="collected" fill="#16a34a" name="Collected" />
          </BarChart>
        </ChartCard>
        <ChartCard title="Bill status">
          <PieChart>
            <Pie data={d.billStatus} dataKey="count" nameKey="status" outerRadius={90} label>
              {d.billStatus.map((s) => (
                <Cell key={s.status} fill={STATUS_COLORS[s.status] || '#64748b'} />
              ))}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ChartCard>
        <ChartCard title="Top consumers (last 6 months)">
          <BarChart data={d.topConsumers} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" /><YAxis type="category" dataKey="name" width={100} /><Tooltip />
            <Bar dataKey="units" fill="#f59e0b" name="Units" />
          </BarChart>
        </ChartCard>
      </div>
    </>
  );
}

function ReaderView({ d }) {
  return (
    <>
      <Cards cards={d.cards} />
      <div className="card section">
        <h3 className="chart-title">Meters still to read this month</h3>
        {d.pendingMeters.length === 0 ? (
          <p className="muted">All meters have been read this month.</p>
        ) : (
          <table>
            <thead><tr><th>Meter</th><th>Customer</th><th>Address</th></tr></thead>
            <tbody>
              {d.pendingMeters.map((m) => (
                <tr key={m.id}><td>{m.meter_number}</td><td>{m.customer_name}</td><td>{m.address}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card section">
        <h3 className="chart-title">My recent readings</h3>
        <table>
          <thead><tr><th>Date</th><th>Meter</th><th>Reading</th><th>Units</th></tr></thead>
          <tbody>
            {d.recentReadings.map((r, i) => (
              <tr key={i}>
                <td>{r.reading_date}</td><td>{r.meter_number}</td>
                <td>{r.reading_value}</td><td>{r.units_consumed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CustomerView({ d }) {
  return (
    <>
      <Cards cards={d.cards} />
      {d.nextDue ? (
        <div className={'card section due-box ' + d.nextDue.status}>
          <div>
            <strong>Next bill due: {rupee(d.nextDue.total_amount)}</strong>
            <div className="muted">
              {d.nextDue.billing_month.slice(0, 7)} &middot; {d.nextDue.units} units &middot; due{' '}
              {d.nextDue.due_date} &middot; {d.nextDue.status}
            </div>
          </div>
          <Link className="btn" to="/bills">View &amp; pay</Link>
        </div>
      ) : (
        <div className="alert success section">You have no pending bills.</div>
      )}
      <div className="charts">
        <ChartCard title="Monthly usage (units)">
          <LineChart data={d.trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="units" stroke="#1d4ed8" strokeWidth={2} name="Units" />
          </LineChart>
        </ChartCard>
        <ChartCard title="Monthly bill amount">
          <BarChart data={d.trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => rupee(v)} />
            <Bar dataKey="amount" fill="#16a34a" name="Amount" />
          </BarChart>
        </ChartCard>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <h2>Welcome, {user.name}</h2>
      {(data.role === 'ADMIN' || data.role === 'STAFF') && <AdminView d={data} />}
      {data.role === 'METER_READER' && <ReaderView d={data} />}
      {data.role === 'CUSTOMER' && <CustomerView d={data} />}
    </div>
  );
}

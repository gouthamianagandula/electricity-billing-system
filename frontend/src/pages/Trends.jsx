import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import api, { errMsg } from '../api';

const rupee = (v) =>
  '\u20B9' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Trends() {
  const [dash, setDash] = useState(null);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/payments')])
      .then(([d, p]) => { setDash(d.data); setPayments(p.data); })
      .catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!dash) return <p>Loading...</p>;

  const trend = dash.trend;
  const avg = trend.length ? trend.reduce((s, t) => s + t.units, 0) / trend.length : 0;
  const peak = trend.reduce((m, t) => (t.units > (m ? m.units : -1) ? t : m), null);
  const last = trend[trend.length - 1];
  const previous = trend.slice(0, -1);
  const prevAvg = previous.length ? previous.reduce((s, t) => s + t.units, 0) / previous.length : 0;
  const high = last && prevAvg > 0 && last.units > 1.5 * prevAvg;
  const upcoming = [...trend].filter((t) => t.status !== 'PAID').sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <div>
      <h2>Consumption Trends</h2>

      {high && (
        <div className="alert error">
          Your latest usage ({last.units} units) is more than 1.5 times your usual average ({prevAvg.toFixed(0)} units).
        </div>
      )}

      <div className="cards">
        <div className="stat"><div className="stat-label">Average monthly usage</div>
          <div className="stat-value">{avg.toFixed(0)} units</div></div>
        <div className="stat"><div className="stat-label">Highest month</div>
          <div className="stat-value">{peak ? peak.units + ' units' : '-'}</div>
          <div className="muted">{peak ? peak.month : ''}</div></div>
        <div className="stat"><div className="stat-label">Latest month</div>
          <div className="stat-value">{last ? last.units + ' units' : '-'}</div>
          <div className="muted">{last ? last.month : ''}</div></div>
        <div className="stat"><div className="stat-label">Pending bills</div>
          <div className="stat-value">{upcoming.length}</div></div>
      </div>

      <div className="charts">
        <div className="card">
          <h3 className="chart-title">Usage over the last 12 months (units)</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" /><YAxis /><Tooltip />
                <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="4 4" label="Avg" />
                <Line type="monotone" dataKey="units" stroke="#1d4ed8" strokeWidth={2} name="Units" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 className="chart-title">Bill amount per month</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => rupee(v)} />
                <Bar dataKey="amount" fill="#16a34a" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card section table-wrap">
        <div className="table-head"><h3 className="chart-title">Due dates</h3></div>
        <table>
          <thead><tr><th>Month</th><th>Units</th><th>Amount</th><th>Due date</th><th>Status</th></tr></thead>
          <tbody>
            {[...trend].reverse().map((t) => (
              <tr key={t.month}>
                <td>{t.month}</td><td>{t.units}</td><td>{rupee(t.amount)}</td>
                <td>{t.due_date}</td><td><span className={'tag ' + t.status}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card section table-wrap">
        <div className="table-head"><h3 className="chart-title">Payment history</h3></div>
        <table>
          <thead><tr><th>Date</th><th>Transaction ID</th><th>Bill month</th><th>Method</th><th>Amount</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                <td>{p.transaction_id}</td><td>{p.billing_month.slice(0, 7)}</td>
                <td>{p.method}</td><td>{rupee(p.amount)}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan="5" className="muted">No payments yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

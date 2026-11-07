import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';

const rupee = (v) =>
  '\u20B9' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Payments() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/payments').then((r) => setRows(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <div className="table-head">
        <h2>Payment History</h2>
        <button className="btn no-print" onClick={() => window.print()}>Print</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Transaction ID</th>
              {user.role !== 'CUSTOMER' && <th>Customer</th>}
              <th>Meter</th><th>Bill month</th><th>Method</th><th>Amount</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.payment_date).toLocaleString('en-IN')}</td>
                <td>{p.transaction_id}</td>
                {user.role !== 'CUSTOMER' && <td>{p.customer_name}</td>}
                <td>{p.meter_number}</td><td>{p.billing_month.slice(0, 7)}</td>
                <td>{p.method}</td><td>{rupee(p.amount)}</td>
                <td><span className="tag PAID">{p.status}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="8" className="muted">No payments yet</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted section">{rows.length} payments &middot; Total {rupee(total)}</p>
    </div>
  );
}

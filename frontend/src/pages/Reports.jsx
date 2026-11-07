import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';

const REPORTS = [
  { key: 'monthly-consumption', title: 'Monthly Consumption' },
  { key: 'customer-billing', title: 'Customer Billing' },
  { key: 'payment-status', title: 'Payment Status' },
  { key: 'high-consumption', title: 'High Consumption' },
];

const head = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const isMoney = (k) => /amount|charge/.test(k);
const rupee = (v) => '\u20B9' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Reports() {
  const [active, setActive] = useState('monthly-consumption');
  const [filters, setFilters] = useState({ month: '', status: '', threshold: '1.5' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const paramsFor = () => {
    if (active === 'customer-billing' && filters.month) return { month: filters.month };
    if (active === 'payment-status' && filters.status) return { status: filters.status };
    if (active === 'high-consumption' && filters.threshold) return { threshold: filters.threshold };
    return {};
  };

  const load = async () => {
    setLoading(true); setError('');
    try {
      const r = await api.get('/reports/' + active, { params: paramsFor() });
      setRows(r.data);
    } catch (e) {
      setError(errMsg(e)); setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [active]);

  const exportCsv = async () => {
    try {
      const r = await api.get('/reports/' + active, {
        params: { ...paramsFor(), format: 'csv' }, responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = active + '.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const cols = rows.length ? Object.keys(rows[0]) : [];
  const title = REPORTS.find((r) => r.key === active).title;
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div>
      <h2 className="no-print">Reports</h2>

      <div className="tabs wide-tabs no-print">
        {REPORTS.map((r) => (
          <button key={r.key} className={active === r.key ? 'tab active' : 'tab'}
            onClick={() => setActive(r.key)}>{r.title}</button>
        ))}
      </div>

      <div className="card no-print">
        <div className="inline-form">
          {active === 'customer-billing' && (
            <div><label>Billing month</label><input type="month" value={filters.month} onChange={set('month')} /></div>
          )}
          {active === 'payment-status' && (
            <div><label>Status</label>
              <select value={filters.status} onChange={set('status')}>
                <option value="">All</option><option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option><option value="OVERDUE">Overdue</option>
              </select></div>
          )}
          {active === 'high-consumption' && (
            <div><label>Times above average</label>
              <input type="number" step="0.1" min="1" value={filters.threshold} onChange={set('threshold')} /></div>
          )}
          <button className="btn" onClick={load}>Apply</button>
          <button className="btn secondary" onClick={exportCsv}>Export CSV</button>
          <button className="btn secondary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {error && <div className="alert error section">{error}</div>}

      <div className="card section table-wrap">
        <div className="table-head">
          <h3 className="chart-title">{title} report</h3>
          <span className="muted">{rows.length} rows</span>
        </div>
        {loading ? <p className="pad">Loading...</p> : (
          <table>
            <thead><tr>{cols.map((c) => <th key={c}>{head(c)}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>
                      {c === 'status'
                        ? <span className={'tag ' + r[c]}>{r[c]}</span>
                        : r[c] === null ? '-' : isMoney(c) ? rupee(r[c]) : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="muted">No data for this report</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

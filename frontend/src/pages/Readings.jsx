import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';

const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export default function Readings() {
  const [meters, setMeters] = useState([]);
  const [readings, setReadings] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ meter_id: '', reading_date: today(), reading_value: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const loadMeters = () =>
    api.get('/meters').then((r) => setMeters(r.data.filter((m) => m.status === 'ACTIVE')))
      .catch((e) => flash('error', errMsg(e)));

  const loadReadings = () =>
    api.get('/readings', { params: filter ? { meter_id: filter } : {} })
      .then((r) => setReadings(r.data))
      .catch((e) => flash('error', errMsg(e)));

  useEffect(() => { loadMeters(); }, []);
  useEffect(() => { loadReadings(); }, [filter]);

  const meter = meters.find((m) => String(m.id) === String(form.meter_id));
  const last = meter && meter.last_reading_value ? Number(meter.last_reading_value) : null;
  const value = form.reading_value === '' ? null : Number(form.reading_value);
  const units = last !== null && value !== null ? Math.round((value - last) * 100) / 100 : null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/readings', form);
      flash('success', 'Reading saved. Units consumed: ' + data.units_consumed);
      setForm({ ...form, reading_value: '' });
      loadMeters();
      loadReadings();
    } catch (err) {
      flash('error', errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2>Meter Readings</h2>
      {msg && <div className={'alert ' + msg.type}>{msg.text}</div>}

      <form className="card" onSubmit={submit}>
        <h3 className="chart-title">Enter new reading</h3>
        <div className="form-grid">
          <div>
            <label>Meter *</label>
            <select value={form.meter_id} required
              onChange={(e) => setForm({ ...form, meter_id: e.target.value })}>
              <option value="">Select meter</option>
              {meters.map((m) => (
                <option key={m.id} value={m.id}>{m.meter_number} - {m.customer_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Reading date *</label>
            <input type="date" value={form.reading_date} required
              onChange={(e) => setForm({ ...form, reading_date: e.target.value })} />
          </div>
          <div>
            <label>Current reading *</label>
            <input type="number" step="0.01" min="0" value={form.reading_value} required
              onChange={(e) => setForm({ ...form, reading_value: e.target.value })} />
          </div>
        </div>

        {meter && (
          <p className="muted">
            Previous reading: {last !== null ? last + ' (on ' + meter.last_reading_date + ')' : 'none (this will be the starting reading)'}
            {units !== null && (units >= 0
              ? <strong> &nbsp;|&nbsp; Units consumed: {units}</strong>
              : <strong className="text-red"> &nbsp;|&nbsp; Reading is lower than the previous one</strong>)}
          </p>
        )}
        <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save reading'}</button>
      </form>

      <div className="card section table-wrap">
        <div className="table-head">
          <h3 className="chart-title">Recent readings</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="inline-select">
            <option value="">All meters</option>
            {meters.map((m) => <option key={m.id} value={m.id}>{m.meter_number}</option>)}
          </select>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Meter</th><th>Customer</th><th>Reading</th><th>Units consumed</th></tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id}>
                <td>{r.reading_date}</td><td>{r.meter_number}</td><td>{r.customer_name}</td>
                <td>{r.reading_value}</td><td>{r.units_consumed}</td>
              </tr>
            ))}
            {readings.length === 0 && <tr><td colSpan="5" className="muted">No readings found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

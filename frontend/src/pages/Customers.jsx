import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';

const EMPTY = {
  name: '', address: '', phone: '', connection_type: 'DOMESTIC',
  meter_number: '', email: '', password: '',
};

export default function Customers() {
  const { user } = useAuth();
  const [tab, setTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [meters, setMeters] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [meterForm, setMeterForm] = useState({ customer_id: '', meter_number: '' });
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = async () => {
    try {
      const [c, m] = await Promise.all([api.get('/customers'), api.get('/meters')]);
      setCustomers(c.data);
      setMeters(m.data);
    } catch (e) {
      flash('error', errMsg(e));
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveCustomer = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put('/customers/' + editId, {
          name: form.name, address: form.address,
          phone: form.phone, connection_type: form.connection_type,
        });
        flash('success', 'Customer updated');
      } else {
        await api.post('/customers', form);
        flash('success', 'Customer added');
      }
      setForm(EMPTY);
      setEditId(null);
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setForm({
      ...EMPTY, name: c.name, address: c.address,
      phone: c.phone || '', connection_type: c.connection_type,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditId(null); setForm(EMPTY); };

  const remove = async (c) => {
    if (!window.confirm('Delete customer ' + c.name + '?')) return;
    try {
      await api.delete('/customers/' + c.id);
      flash('success', 'Customer deleted');
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const addMeter = async (e) => {
    e.preventDefault();
    try {
      await api.post('/meters', meterForm);
      flash('success', 'Meter added');
      setMeterForm({ customer_id: '', meter_number: '' });
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const toggleMeter = async (m) => {
    try {
      await api.patch('/meters/' + m.id + '/status', {
        status: m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const q = search.toLowerCase();
  const shownCustomers = customers.filter((c) =>
    [c.name, c.address, c.email, c.meters].join(' ').toLowerCase().includes(q));
  const shownMeters = meters.filter((m) =>
    [m.meter_number, m.customer_name, m.address].join(' ').toLowerCase().includes(q));

  return (
    <div>
      <h2>Customers &amp; Meters</h2>
      {msg && <div className={'alert ' + msg.type}>{msg.text}</div>}

      <div className="tabs wide">
        <button className={tab === 'customers' ? 'tab active' : 'tab'}
          onClick={() => setTab('customers')}>Customers ({customers.length})</button>
        <button className={tab === 'meters' ? 'tab active' : 'tab'}
          onClick={() => setTab('meters')}>Meters ({meters.length})</button>
      </div>

      <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {tab === 'customers' && (
        <>
          <form className="card section" onSubmit={saveCustomer}>
            <h3 className="chart-title">{editId ? 'Edit customer' : 'Add customer'}</h3>
            <div className="form-grid">
              <div><label>Name *</label><input value={form.name} onChange={set('name')} required /></div>
              <div><label>Address *</label><input value={form.address} onChange={set('address')} required /></div>
              <div><label>Phone</label><input value={form.phone} onChange={set('phone')} /></div>
              <div>
                <label>Connection type</label>
                <select value={form.connection_type} onChange={set('connection_type')}>
                  <option value="DOMESTIC">Domestic</option>
                  <option value="COMMERCIAL">Commercial</option>
                </select>
              </div>
              {!editId && (
                <>
                  <div><label>Meter number (optional)</label>
                    <input value={form.meter_number} onChange={set('meter_number')} /></div>
                  <div><label>Login email (optional)</label>
                    <input type="email" value={form.email} onChange={set('email')} /></div>
                  <div><label>Login password (optional)</label>
                    <input type="password" value={form.password} onChange={set('password')} /></div>
                </>
              )}
            </div>
            <button className="btn">{editId ? 'Save changes' : 'Add customer'}</button>{' '}
            {editId && <button type="button" className="btn secondary" onClick={cancelEdit}>Cancel</button>}
          </form>

          <div className="card section table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Meters</th><th></th></tr>
              </thead>
              <tbody>
                {shownCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td><td>{c.name}</td><td>{c.address}</td>
                    <td>{c.phone}</td><td>{c.email}</td><td>{c.meters}</td>
                    <td className="actions">
                      <button className="btn secondary small" onClick={() => startEdit(c)}>Edit</button>{' '}
                      {user.role === 'ADMIN' && (
                        <button className="btn danger small" onClick={() => remove(c)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
                {shownCustomers.length === 0 && (
                  <tr><td colSpan="7" className="muted">No customers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'meters' && (
        <>
          <form className="card section" onSubmit={addMeter}>
            <h3 className="chart-title">Add meter to a customer</h3>
            <div className="form-grid">
              <div>
                <label>Customer *</label>
                <select value={meterForm.customer_id} required
                  onChange={(e) => setMeterForm({ ...meterForm, customer_id: e.target.value })}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Meter number *</label>
                <input value={meterForm.meter_number} required
                  onChange={(e) => setMeterForm({ ...meterForm, meter_number: e.target.value })} />
              </div>
            </div>
            <button className="btn">Add meter</button>
          </form>

          <div className="card section table-wrap">
            <table>
              <thead>
                <tr><th>Meter</th><th>Customer</th><th>Address</th><th>Last reading</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {shownMeters.map((m) => (
                  <tr key={m.id}>
                    <td>{m.meter_number}</td><td>{m.customer_name}</td><td>{m.address}</td>
                    <td>{m.last_reading_value ? m.last_reading_value + ' (' + m.last_reading_date + ')' : '-'}</td>
                    <td><span className={'tag ' + (m.status === 'ACTIVE' ? 'PAID' : 'OVERDUE')}>{m.status}</span></td>
                    <td>
                      <button className="btn secondary small" onClick={() => toggleMeter(m)}>
                        {m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {shownMeters.length === 0 && (
                  <tr><td colSpan="6" className="muted">No meters found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

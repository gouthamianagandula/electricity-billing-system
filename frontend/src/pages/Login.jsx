import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api, { errMsg } from '../api';

const DEMO = [
  { label: 'Admin', email: 'admin@demo.com' },
  { label: 'Staff', email: 'staff@demo.com' },
  { label: 'Meter Reader', email: 'reader@demo.com' },
  { label: 'Customer', email: 'customer1@demo.com' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', address: '', phone: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'register') {
        await api.post('/auth/register', form);
        setInfo('Registered successfully. Please log in.');
        setMode('login');
      } else {
        await login(form.email, form.password);
        navigate('/');
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <h2>&#9889; PowerBill</h2>
        <p className="muted">Electricity Consumption Tracking and Billing System</p>

        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}>Login</button>
          <button type="button" className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}>Register</button>
        </div>

        {mode === 'register' && (
          <>
            <label>Full name</label>
            <input value={form.name} onChange={set('name')} required />
            <label>Address</label>
            <input value={form.address} onChange={set('address')} required />
            <label>Phone</label>
            <input value={form.phone} onChange={set('phone')} />
          </>
        )}
        <label>Email</label>
        <input type="email" value={form.email} onChange={set('email')} required />
        <label>Password</label>
        <input type="password" value={form.password} onChange={set('password')} required />

        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert success">{info}</div>}

        <button className="btn" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
        </button>

        {mode === 'login' && (
          <div className="demo">
            <span className="muted">Demo logins (password: password123)</span>
            <div className="demo-row">
              {DEMO.map((d) => (
                <button type="button" key={d.email} className="btn secondary small"
                  onClick={() => setForm({ ...form, email: d.email, password: 'password123' })}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

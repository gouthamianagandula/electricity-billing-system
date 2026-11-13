import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api, { errMsg } from '../api';

const DEMO = [
  { label: 'Admin', email: 'admin@demo.com', icon: '\u{1F465}' },
  { label: 'Staff', email: 'staff@demo.com', icon: '\u{1F4BC}' },
  { label: 'Meter Reader', email: 'reader@demo.com', icon: '\u{1F4DF}' },
  { label: 'Customer', email: 'customer1@demo.com', icon: '\u{1F464}' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', address: '', phone: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isLogin = mode === 'login';

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (!isLogin) {
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
    <div className="pb-login">
      <section className="pb-hero">
        <div className="pb-brand">
          <span className="pb-bolt">&#9889;</span>
          <div>
            <div className="pb-logo">Power<b>Bill</b></div>
            <div className="pb-sub">Track &middot; Monitor &middot; Pay</div>
          </div>
        </div>
        <h1>Electricity Consumption<br />Tracking and <span>Billing System</span></h1>
        <p className="pb-tag">Smart Energy. Smarter Management.</p>
        <div className="pb-feats">
          <div><i>&#9889;</i><span>Track<br />Usage</span></div>
          <div><i>&#128200;</i><span>View<br />Bills</span></div>
          <div><i>&#128737;</i><span>Manage<br />Payments</span></div>
        </div>
      </section>

      <form className="pb-card" onSubmit={submit}>
        <div className="pb-badge">&#9889;</div>
        <h2>{isLogin ? 'Welcome Back!' : 'Create Account'}</h2>
        <p className="pb-card-sub">{isLogin ? 'Login to your PowerBill account' : 'Register as a customer'}</p>

        {!isLogin && (
          <>
            <div className="pb-field"><span className="ic">&#128100;</span>
              <input placeholder="Full name" value={form.name} onChange={set('name')} required /></div>
            <div className="pb-field"><span className="ic">&#127968;</span>
              <input placeholder="Address" value={form.address} onChange={set('address')} required /></div>
            <div className="pb-field"><span className="ic">&#128222;</span>
              <input placeholder="Phone" value={form.phone} onChange={set('phone')} /></div>
          </>
        )}
        <div className="pb-field"><span className="ic">&#9993;</span>
          <input type="email" placeholder="Email Address" value={form.email} onChange={set('email')} required /></div>
        <div className="pb-field"><span className="ic">&#128274;</span>
          <input type={show ? 'text' : 'password'} placeholder="Password" value={form.password}
            onChange={set('password')} required />
          <button type="button" className="pb-eye" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
        </div>

        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert success">{info}</div>}

        <button className="btn pb-go" disabled={busy}>
          {busy ? 'Please wait...' : isLogin ? 'Login \u2192' : 'Create account \u2192'}
        </button>

        {isLogin && (
          <>
            <div className="pb-divider"><span>Demo Logins</span></div>
            <div className="pb-demo">
              {DEMO.map((d) => (
                <button type="button" key={d.email}
                  onClick={() => setForm({ ...form, email: d.email, password: 'password123' })}>
                  <span>{d.icon}</span> {d.label}
                </button>
              ))}
            </div>
            <p className="pb-hint">Click a role, then press Login (password: password123)</p>
          </>
        )}

        <p className="pb-switch">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(isLogin ? 'register' : 'login'); }}>
            {isLogin ? 'Register here' : 'Login here'}
          </a>
        </p>
      </form>
    </div>
  );
}

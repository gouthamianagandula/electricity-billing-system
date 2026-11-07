import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';

const label = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const money = /amount|revenue|paid|due$/;

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
      <div className="cards">
        {Object.entries(data.cards).map(([k, v]) => (
          <div className="stat" key={k}>
            <div className="stat-label">{label(k)}</div>
            <div className="stat-value">
              {money.test(k) ? '\u20B9' + Number(v).toLocaleString('en-IN') : v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

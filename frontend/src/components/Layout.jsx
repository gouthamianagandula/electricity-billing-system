import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const MENU = [
  { to: '/', label: 'Dashboard', roles: ['ADMIN', 'STAFF', 'CUSTOMER', 'METER_READER'], end: true },
  { to: '/customers', label: 'Customers & Meters', roles: ['ADMIN', 'STAFF'] },
  { to: '/readings', label: 'Meter Readings', roles: ['ADMIN', 'STAFF', 'METER_READER'] },
  { to: '/bills', label: 'Bills', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { to: '/payments', label: 'Payments', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { to: '/trends', label: 'Consumption Trends', roles: ['CUSTOMER'] },
  { to: '/reports', label: 'Reports', roles: ['ADMIN', 'STAFF'] },
];

const ROLE_LABEL = {
  ADMIN: 'Admin', STAFF: 'Utility Staff', CUSTOMER: 'Customer', METER_READER: 'Meter Reader',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">&#9889; PowerBill</div>
        <nav>
          {MENU.filter((m) => m.roles.includes(user.role)).map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end}
              className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <strong>{user.name}</strong>
            <span className="badge">{ROLE_LABEL[user.role]}</span>
          </div>
          <button className="btn secondary" onClick={handleLogout}>Logout</button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}

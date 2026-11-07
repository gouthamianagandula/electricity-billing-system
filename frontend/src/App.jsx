import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './components/Layout';
import Placeholder from './components/Placeholder';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Readings from './pages/Readings';
import Bills from './pages/Bills';
import Payments from './pages/Payments';
import Trends from './pages/Trends';
import Reports from './pages/Reports';

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="customers" element={
          <Protected roles={['ADMIN', 'STAFF']}><Customers /></Protected>} />
        <Route path="readings" element={
          <Protected roles={['ADMIN', 'STAFF', 'METER_READER']}><Readings /></Protected>} />
        <Route path="bills" element={
          <Protected roles={['ADMIN', 'STAFF', 'CUSTOMER']}><Bills /></Protected>} />
        <Route path="payments" element={
          <Protected roles={['ADMIN', 'STAFF', 'CUSTOMER']}><Payments /></Protected>} />
        <Route path="trends" element={
          <Protected roles={['CUSTOMER']}><Trends /></Protected>} />
        <Route path="reports" element={
          <Protected roles={['ADMIN', 'STAFF']}><Reports /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}





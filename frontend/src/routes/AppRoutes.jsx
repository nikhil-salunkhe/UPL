import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from '../pages/Home/Home';
import Players from '../pages/Players/Players';
import PlayerRegister from '../pages/Register/PlayerRegister';
import Owners from '../pages/Owners/Owners';
import Sponsors from '../pages/Sponsors/Sponsors';
import Matches from '../pages/Matches/Matches';
import AdminLogin from '../pages/Admin/AdminLogin';
import AdminDashboard from '../pages/Admin/AdminDashboard';

// Shows briefly on mount and on every route change (key remounts it).
// Kept as its own component so no setState happens synchronously inside an effect.
const PageLoader = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="page-loader">
      <div className="loader-ring" />
      <p>Loading tournament portal...</p>
    </div>
  );
};

const AppRoutes = () => {
  const location = useLocation();

  return (
    <>
      <PageLoader key={location.pathname} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/players" element={<Players />} />
        <Route path="/register" element={<PlayerRegister />} />
        <Route path="/owners" element={<Owners />} />
        <Route path="/sponsors" element={<Sponsors />} />
        <Route path="/matches" element={<Matches />} />

        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default AppRoutes;

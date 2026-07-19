import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from '../pages/Home/Home';
import Players from '../pages/Players/Players';
import Owners from '../pages/Owners/Owners';
import Sponsors from '../pages/Sponsors/Sponsors';
import Matches from '../pages/Matches/Matches';
import AdminLogin from '../pages/Admin/AdminLogin';
import AdminDashboard from '../pages/Admin/AdminDashboard';

const AppRoutes = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  return (
    <>
      {loading && (
        <div className="page-loader">
          <div className="loader-ring" />
          <p>Loading tournament portal...</p>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/players" element={<Players />} />
        <Route path="/owners" element={<Owners />} />
        <Route path="/sponsors" element={<Sponsors />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default AppRoutes;

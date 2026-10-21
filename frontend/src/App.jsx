import { BrowserRouter, useLocation } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import './App.css';

function App() {
  const location = useLocation();
  // Hide the public navbar on admin routes — the admin dashboard has its own
  // sidebar layout and should take the full width.
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <BrowserRouter>
      <div className={`app-shell${isAdmin ? ' admin-shell' : ''}`}>
        {!isAdmin && <Navbar />}
        <main className={`main-content${isAdmin ? ' admin-main' : ''}`}>
          <AppRoutes />
        </main>
        {!isAdmin && <Footer />}
      </div>
    </BrowserRouter>
  );
}

export default App;

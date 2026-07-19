import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const links = [
    { to: '/', label: 'Home' },
    { to: '/players', label: 'Players' },
    { to: '/owners', label: 'Owners' },
    { to: '/sponsors', label: 'Sponsors' },
    { to: '/matches', label: 'Matches' }
  ];

  return (
    <header className="navbar">
      <div className="nav-brand">
        <span className="brand-mark">🏏</span>
        <div>
          <h3>UPL Village Cup</h3>
          <p>Community Cricket Festival</p>
        </div>
      </div>
      <nav className="nav-links">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};

export default Navbar;

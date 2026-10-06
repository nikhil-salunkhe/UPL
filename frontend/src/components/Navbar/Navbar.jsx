import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/', label: 'Home' },
    { to: '/players', label: 'Players' },
    { to: '/owners', label: 'Owners' },
    { to: '/sponsors', label: 'Sponsors' },
    { to: '/matches', label: 'Matches' },
    { to: '/register', label: '📝 Register', highlight: true }
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
      <button
        type="button"
        className="nav-toggle"
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? '✕' : '☰'}
      </button>
      <nav className={`nav-links${menuOpen ? ' open' : ''}`}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}${link.highlight ? ' highlight' : ''}`
            }
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};

export default Navbar;

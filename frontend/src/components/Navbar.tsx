import { useEffect, useState } from 'react';
import { Clapperboard, LayoutDashboard, LogOut, Menu, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha o menu mobile sempre que a rota muda
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Trava o scroll do body quando o menu mobile está aberto
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function linkClass({ isActive }: { isActive: boolean }) {
    return isActive ? 'active' : '';
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <NavLink to="/"><Clapperboard size={20} /> Minha Biblioteca</NavLink>
      </div>

      <button
        type="button"
        className="navbar-toggle"
        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {menuOpen && <div className="navbar-overlay" onClick={() => setMenuOpen(false)} />}

      <nav className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        <NavLink to="/" end className={linkClass}>
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>
        <NavLink to="/catalogo" className={linkClass}>
          <Clapperboard size={16} /> Catálogo
        </NavLink>
        {user.role === 'ADMIN' && (
          <NavLink to="/admin" className={linkClass}>
            <ShieldCheck size={16} /> Administração
          </NavLink>
        )}
        <NavLink to="/perfil" className={linkClass}>
          <UserIcon size={16} /> Perfil
        </NavLink>

        <div className="navbar-links-divider" />

        <div className="navbar-user navbar-user-mobile">
          <span className="navbar-user-name">
            <span className="navbar-avatar">{user.nome[0]?.toUpperCase()}</span>
            {user.nome}
          </span>
          <button onClick={handleLogout} className="btn-link" title="Sair">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </nav>

      <div className="navbar-user navbar-user-desktop">
        <span className="navbar-user-name">
          <span className="navbar-avatar">{user.nome[0]?.toUpperCase()}</span>
          {user.nome}
        </span>
        <button onClick={handleLogout} className="btn-link" title="Sair">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

/**
 * The Way Header - Minimal Navigation
 *
 * Chapter 17: "The best leaders are barely known"
 * Chapter 56: "Those who know don't speak"
 *
 * A contemplative navigation that serves without dominating
 */

import { Link, useLocation } from 'react-router-dom';

export default function WayHeader() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header style={{
      background: 'var(--way-ivory)',
      borderBottom: `1px solid var(--way-ivory-dark)`,
      padding: 'var(--space-lg) 0',
      position: 'sticky',
      top: 0,
      zIndex: 'var(--z-sticky)',
      backdropFilter: 'blur(8px)',
      backgroundColor: 'rgba(250, 249, 246, 0.95)'
    }}>
      <nav style={{
        maxWidth: 'var(--container-prose)',
        margin: '0 auto',
        padding: '0 var(--space-3xl)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* Logo / Home Link - Minimal */}
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            color: 'var(--way-slate)',
            fontSize: 'var(--text-base)',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            letterSpacing: '0.05em',
            transition: 'opacity var(--transition-base)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          The Way of Code OS
        </Link>

        {/* Navigation Links - Chapter Numbers Style */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-xl)',
          alignItems: 'center'
        }}>
          <NavLink to="/philosophy" active={isActive('/philosophy')}>
            Philosophy
          </NavLink>
          <NavLink to="/projects" active={isActive('/projects')}>
            Works
          </NavLink>
          <NavLink to="/chat" active={isActive('/chat')}>
            Studio
          </NavLink>
          <NavLink to="/intelligence" active={isActive('/intelligence')}>
            Council
          </NavLink>
        </div>
      </nav>
    </header>
  );
}

interface NavLinkProps {
  to: string;
  active: boolean;
  children: React.ReactNode;
}

function NavLink({ to, active, children }: NavLinkProps) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: 'none',
        color: active ? 'var(--way-slate)' : 'var(--way-gray)',
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)',
        fontWeight: active ? 500 : 400,
        borderBottom: active ? `2px solid var(--way-slate)` : '2px solid transparent',
        paddingBottom: '4px',
        transition: 'all var(--transition-base)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--way-slate)';
        e.currentTarget.style.borderBottomColor = 'var(--way-slate)';
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--way-gray)';
          e.currentTarget.style.borderBottomColor = 'transparent';
        }
      }}
    >
      {children}
    </Link>
  );
}

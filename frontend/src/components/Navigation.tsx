import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './Navigation.css';

export default function Navigation() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;
    const [scrolled, setScrolled] = useState(false);

    // Track scroll for nav background change
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`nav-container ${scrolled ? 'scrolled' : ''}`}>
            <div className="nav-content">
                <Link to="/" className="nav-logo">
                    <span className="nav-logo-text">Isaac Hernandez</span>
                </Link>

                <div className="nav-links">
                    <Link
                        to="/projects"
                        className={`nav-link ${isActive('/projects') ? 'active' : ''}`}
                    >
                        <span className="nav-link-text">Projects</span>
                    </Link>
                    <Link
                        to="/essays"
                        className={`nav-link ${isActive('/essays') ? 'active' : ''}`}
                    >
                        <span className="nav-link-text">Essays</span>
                    </Link>
                    <Link
                        to="/consulting"
                        className={`nav-link ${isActive('/consulting') ? 'active' : ''}`}
                    >
                        <span className="nav-link-text">Consulting</span>
                    </Link>
                    <Link
                        to="/about"
                        className={`nav-link ${isActive('/about') ? 'active' : ''}`}
                    >
                        <span className="nav-link-text">About</span>
                    </Link>
                    <Link
                        to="/forge"
                        className={`nav-link ${isActive('/forge') ? 'active' : ''}`}
                    >
                        The Forge
                    </Link>
                    <Link
                        to="/publish"
                        className={`nav-link ${isActive('/publish') ? 'active' : ''}`}
                    >
                        Control
                    </Link>
                    <a
                        href="https://github.com/isaacsight"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav-link nav-external"
                    >
                        <span className="nav-link-text">GitHub</span>
                        <span className="nav-external-icon">↗</span>
                    </a>
                </div>
            </div>
        </nav>
    );
}

import { Link, useLocation } from 'react-router-dom';

export default function Navigation() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="nav-container">
            <div className="nav-content">
                <Link to="/" className="nav-logo">
                    Isaac Hernandez
                </Link>
                <div className="nav-links">
                    <Link
                        to="/projects"
                        className={`nav-link ${isActive('/projects') ? 'active' : ''}`}
                    >
                        Projects
                    </Link>
                    <Link
                        to="/about"
                        className={`nav-link ${isActive('/about') ? 'active' : ''}`}
                    >
                        About
                    </Link>
                    <a
                        href="https://github.com/isaachernandez"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav-link nav-external"
                    >
                        GitHub
                    </a>
                </div>
            </div>
        </nav>
    );
}

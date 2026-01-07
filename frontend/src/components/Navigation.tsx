import { Link, useLocation } from 'react-router-dom';
import { Terminal, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Navigation() {
    const location = useLocation();
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Check for system preference or saved preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

        setIsDark(shouldBeDark);
        document.documentElement.setAttribute('data-theme', shouldBeDark ? 'dark' : 'light');
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light');
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="nav-container">
            <div className="nav-content">
                <Link to="/" className="nav-logo">
                    <Terminal className="nav-icon" />
                    <span>Sovereign Lab</span>
                </Link>
                <div className="nav-links">
                    <Link
                        to="/"
                        className={`nav-link ${isActive('/') ? 'active' : ''}`}
                    >
                        Home
                    </Link>
                    <Link
                        to="/chat"
                        className={`nav-link ${isActive('/chat') ? 'active' : ''}`}
                    >
                        Studio
                    </Link>
                    <Link
                        to="/projects/titan"
                        className={`nav-link ${isActive('/projects/titan') ? 'active' : ''}`}
                    >
                        Titan DB
                    </Link>
                    <Link
                        to="/intelligence"
                        className={`nav-link ${isActive('/intelligence') ? 'active' : ''}`}
                    >
                        Intelligence
                    </Link>
                    <button
                        onClick={toggleTheme}
                        className="theme-toggle-btn"
                        aria-label="Toggle theme"
                    >
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>
        </nav>
    );
}

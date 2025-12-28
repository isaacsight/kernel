import { Link } from 'react-router-dom';
import { Terminal } from 'lucide-react';

export default function Navigation() {
    return (
        <nav className="nav-container">
            <div className="nav-content">
                <Link to="/" className="nav-logo">
                    <Terminal className="nav-icon" />
                    <span>Sovereign Lab</span>
                </Link>
                <div className="nav-links">
                    <Link to="/" className="nav-link">Home</Link>
                    <Link to="/chat" className="nav-link">Studio</Link>
                    <Link to="/projects/titan" className="nav-link">Titan DB</Link>
                </div>
            </div>
        </nav>
    );
}

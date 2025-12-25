import { Link } from 'react-router-dom';
import { Terminal } from 'lucide-react';

export default function Navigation() {
    return (
        <nav className="nav-container">
            <div className="nav-content">
                <Link to="/" className="nav-logo">
                    <Terminal className="nav-icon" />
                    <span>Isaac's Lab</span>
                </Link>
                <div className="nav-links">
                    <Link to="/" className="nav-link">Home</Link>
                    <Link to="/chat" className="nav-link">Studio</Link>
                    <Link to="/intelligence" className="nav-link" style={{ color: '#8b5cf6' }}>Intelligence</Link>
                    <Link to="/clients" className="nav-link" style={{ color: '#4ec9b0' }}>Clients</Link>
                    <Link to="/projects/titan" className="nav-link">Titan DB</Link>
                    <Link to="/projects/quantframe" className="nav-link">QuantFrame</Link>
                </div>
            </div>
        </nav>
    );
}

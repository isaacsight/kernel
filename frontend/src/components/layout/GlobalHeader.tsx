import { Link } from 'react-router-dom';
import './GlobalHeader.css';

const GlobalHeader = () => {
    return (
        <header className="global-header">
            <Link to="/" className="site-title">
                Does This Feel Right?
            </Link>
        </header>
    );
};

export default GlobalHeader;

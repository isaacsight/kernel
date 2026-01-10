import { NavLink } from 'react-router-dom';
import './ChapterNav.css';

const chapters = [
    { path: '/', label: '00', title: 'Index' },
    { path: '/essays', label: '01', title: 'Essays' },
    { path: '/about', label: '02', title: 'About' },
];

export default function ChapterNav() {
    return (
        <nav className="chapter-nav">
            <ul className="chapter-list">
                {chapters.map((chapter) => (
                    <li key={chapter.path} className="chapter-item">
                        <NavLink
                            to={chapter.path}
                            className={({ isActive }) =>
                                `chapter-link ${isActive ? 'active' : ''}`
                            }
                            title={chapter.title}
                        >
                            {chapter.label}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

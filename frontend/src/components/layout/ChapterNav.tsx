import './ChapterNav.css';

const chapters = Array.from({ length: 81 }, (_, i) => ({
    id: i + 1,
    label: (i + 1).toString().padStart(2, '0')
}));

export default function ChapterNav() {
    return (
        <nav className="chapter-spine">
            <div className="spine-header">WOC</div>
            <ul className="spine-list">
                {chapters.map((chapter) => (
                    <li key={chapter.id} className="spine-item">
                        <a href={`#chapter-${chapter.id}`} className="spine-link">
                            {chapter.label}
                        </a>
                    </li>
                ))}
                <li className="spine-item">
                    <a href="#chapter-ps" className="spine-link">PS</a>
                </li>
            </ul>
        </nav>
    );
}

import ProseContainer from '../components/layout/ProseContainer';
import { Link } from 'react-router-dom';
import './EssaysPage.css';

const essays = [
    { slug: 'native-coding', title: 'Native Coding', date: '2025-12-01', subtitle: 'Writing code that feels like it belongs.' },
    { slug: 'the-system-compiler', title: 'The System Compiler', date: '2025-11-15', subtitle: 'Agents as compilers for human intent.' },
    { slug: 'warm-computing', title: 'Warm Computing', date: '2025-10-22', subtitle: 'Moving away from the sterile glass of corporate tech.' },
    { slug: 'complexity-collapse', title: 'Complexity Collapse', date: '2025-09-10', subtitle: 'When the system becomes too heavy to hold.' },
];

export default function EssaysPage() {
    return (
        <ProseContainer>
            <header className="page-header">
                <h1>Essays</h1>
                <p className="intro-text">Thoughts on software, design, and the nature of tools.</p>
            </header>

            <div className="essays-index">
                {essays.map(essay => (
                    <article key={essay.slug} className="essay-entry">
                        <div className="essay-meta">{essay.date}</div>
                        <h2 className="essay-title">
                            <Link to={`/essays/${essay.slug}`}>{essay.title}</Link>
                        </h2>
                        <p className="essay-subtitle">{essay.subtitle}</p>
                    </article>
                ))}
            </div>
        </ProseContainer>
    );
}

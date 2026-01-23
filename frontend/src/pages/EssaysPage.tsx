import { Link } from 'react-router-dom';
import { useScrollReveal, useStaggeredReveal } from '../hooks/useScrollReveal';
import './EssaysPage.css';

interface Essay {
    slug: string;
    title: string;
    date: string;
    subtitle: string;
    category: 'engineering' | 'philosophy' | 'design' | 'systems';
}

const essays: Essay[] = [
    {
        slug: 'anatomy-of-an-answer-engine',
        title: 'Anatomy of an Answer Engine',
        date: '2026-01-01',
        subtitle: 'How AI systems transform questions into understanding.',
        category: 'engineering'
    },
    {
        slug: 'infinity-paradoxes-computation',
        title: 'Infinity Paradoxes in Computation',
        date: '2026-01-04',
        subtitle: 'Where mathematics meets the limits of machines.',
        category: 'philosophy'
    },
    {
        slug: 'the-death-of-coding',
        title: 'The Death of Coding',
        date: '2025-12-13',
        subtitle: 'What happens when AI writes better code than we do.',
        category: 'philosophy'
    },
    {
        slug: 'pattern-enterprise-agents',
        title: 'Pattern: Enterprise Agents',
        date: '2025-12-20',
        subtitle: 'Designing multi-agent systems for real organizations.',
        category: 'systems'
    },
    {
        slug: 'studio-os-engineering-a-live-lab',
        title: 'Engineering a Live Lab',
        date: '2025-12-22',
        subtitle: 'Building Studio OS as a cognitive architecture.',
        category: 'engineering'
    },
    {
        slug: 'content-factory-blueprint',
        title: 'The Content Factory Blueprint',
        date: '2025-12-15',
        subtitle: 'Automating creation without losing the human element.',
        category: 'systems'
    },
    {
        slug: 'technicians-trap',
        title: "The Technician's Trap",
        date: '2025-12-10',
        subtitle: 'When expertise becomes a prison.',
        category: 'philosophy'
    },
    {
        slug: 'architecting-the-swarm',
        title: 'Architecting the Swarm',
        date: '2025-11-28',
        subtitle: 'Coordinating 46+ AI agents without chaos.',
        category: 'systems'
    },
];

const categoryLabels: Record<Essay['category'], string> = {
    engineering: 'Engineering',
    philosophy: 'Philosophy',
    design: 'Design',
    systems: 'Systems'
};

export default function EssaysPage() {
    const { ref: headerRef, isRevealed: headerVisible } = useScrollReveal();
    const { containerRef, revealedItems } = useStaggeredReveal(essays.length, { staggerDelay: 100 });

    return (
        <div className="essays-page">
            <header
                ref={headerRef}
                className={`essays-header ${headerVisible ? 'revealed' : ''}`}
            >
                <span className="essays-number">Writing</span>
                <h1 className="essays-title">Essays</h1>
                <p className="essays-intro">
                    Thoughts on software, systems, and the nature of tools that think.
                </p>
            </header>

            <div ref={containerRef} className="essays-grid">
                {essays.map((essay, index) => (
                    <article
                        key={essay.slug}
                        className={`essay-card ${revealedItems[index] ? 'revealed' : ''}`}
                    >
                        <div className="essay-meta">
                            <time className="essay-date">{essay.date}</time>
                            <span className="essay-category">{categoryLabels[essay.category]}</span>
                        </div>
                        <h2 className="essay-title">
                            <Link to={`/essays/${essay.slug}`}>
                                {essay.title}
                            </Link>
                        </h2>
                        <p className="essay-subtitle">{essay.subtitle}</p>
                        <Link to={`/essays/${essay.slug}`} className="essay-read-link">
                            Read essay →
                        </Link>
                    </article>
                ))}
            </div>

            <footer className="essays-footer">
                <p>More essays coming soon. Each one is a seed for deeper exploration.</p>
            </footer>
        </div>
    );
}

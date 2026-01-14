import { Github, Mail, Linkedin } from 'lucide-react';
import './AboutPage.css';

export default function AboutPage() {
    return (
        <div className="about-page">
            <header className="about-header">
                <h1 className="page-title">About</h1>
            </header>

            <section className="about-intro">
                <p className="intro-text">
                    I'm Isaac Hernandez—a software engineer who believes that code is a craft,
                    not just a trade.
                </p>
            </section>

            <section className="about-body">
                <div className="about-section">
                    <h2>The Philosophy</h2>
                    <p>
                        There's a question I ask myself with every project: <em>Does this feel right?</em>
                    </p>
                    <p>
                        Not "does it work" or "is it fast" or "will it scale"—those matter, but they're
                        table stakes. The deeper question is about feel. About whether the system breathes.
                        Whether someone using it six months from now will understand not just what it does,
                        but why it was built this way.
                    </p>
                    <p>
                        I build tools and systems that compound. Not features that get shipped and forgotten,
                        but frameworks that make future problems easier. Every conversation should leave
                        behind residue—artifacts, patterns, reusable pieces of thinking.
                    </p>
                </div>

                <div className="about-section">
                    <h2>The Work</h2>
                    <p>
                        Most of my time goes into the Sovereign Laboratory OS—a cognitive architecture
                        for building permanent thinking systems. It's a multi-agent swarm with specialized
                        modules for design intelligence, answer engines, and memory management. The kind of
                        infrastructure that most people don't see, but that makes everything else possible.
                    </p>
                    <p>
                        I also care deeply about interface design. Not in the Dribbble sense of making things
                        pretty, but in the sense of making things disappear. The best interfaces don't demand
                        attention—they create space for the work that matters.
                    </p>
                </div>

                <div className="about-section">
                    <h2>The Stack</h2>
                    <p>
                        Python and TypeScript, mostly. FastAPI for backends, React for interfaces.
                        PostgreSQL with pgvector for semantic search. Vite because life is short.
                    </p>
                    <p>
                        But tools are just tools. What matters is the thinking behind them—knowing when
                        to reach for abstraction and when to keep things concrete, when to optimize and
                        when to ship.
                    </p>
                </div>

                <div className="about-section">
                    <h2>The Name</h2>
                    <p>
                        "Does This Feel Right" comes from a production philosophy I admire. Before asking
                        if something is correct or optimal, ask if it feels right. Trust the intuition
                        that comes from caring deeply about craft.
                    </p>
                </div>
            </section>

            <section className="about-connect">
                <h2>Connect</h2>
                <p>I'm always interested in thoughtful conversations about systems, design, and craft.</p>
                <div className="connect-links">
                    <a
                        href="https://github.com/isaachernandez"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="connect-link"
                    >
                        <Github size={18} />
                        <span>GitHub</span>
                    </a>
                    <a
                        href="mailto:hello@doesthisfeelright.com"
                        className="connect-link"
                    >
                        <Mail size={18} />
                        <span>Email</span>
                    </a>
                    <a
                        href="https://linkedin.com/in/isaachernandez"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="connect-link"
                    >
                        <Linkedin size={18} />
                        <span>LinkedIn</span>
                    </a>
                </div>
            </section>
        </div>
    );
}

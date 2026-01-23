import { Link } from 'react-router-dom';
import {
    Brain,
    Code2,
    Layers,
    Gamepad2,
    FileText,
    Cpu,
    Sparkles,
    ArrowRight,
    Github,
    Mail,
    Zap,
    Database,
    Globe,
    Terminal,
    Palette,
    Bot
} from 'lucide-react';
import { useScrollReveal, useStaggeredReveal, useHeroEntrance } from '../hooks/useScrollReveal';
import './LandingPage.css';

// Micro stats
const stats = [
    { value: '46+', label: 'AI Agents', icon: Brain },
    { value: '81', label: 'Chapters', icon: FileText },
    { value: '1M+', label: 'Context Tokens', icon: Database },
    { value: '∞', label: 'Ideas', icon: Sparkles },
];

// Core accomplishments
const accomplishments = [
    {
        icon: Brain,
        title: 'Sovereign Laboratory OS',
        subtitle: 'Cognitive Architecture',
        description: 'Multi-agent swarm orchestration system',
        tags: ['Python', 'FastAPI', 'React'],
        link: '/projects'
    },
    {
        icon: Gamepad2,
        title: 'Codex Wars',
        subtitle: 'RTS Game Engine',
        description: 'Claude vs Gemini faction warfare',
        tags: ['TypeScript', 'Canvas', 'Game Dev'],
        link: '/warcraft'
    },
    {
        icon: Palette,
        title: 'Rubin Design System',
        subtitle: 'Literary Minimalism',
        description: 'Contemplative UI tokens & components',
        tags: ['CSS', 'Design Tokens', 'React'],
        link: '/about'
    },
    {
        icon: Terminal,
        title: 'AI CLI Skills',
        subtitle: 'Claude + Gemini',
        description: 'Custom skills for AI coding assistants',
        tags: ['Markdown', 'Prompting', 'MCP'],
        link: '/essays'
    },
];

// Quick links
const quickLinks = [
    { icon: FileText, label: 'Essays', path: '/essays', count: 8 },
    { icon: Cpu, label: 'Projects', path: '/projects', count: 3 },
    { icon: Gamepad2, label: 'Play RTS', path: '/warcraft' },
    { icon: Globe, label: 'Consulting', path: '/consulting' },
];

// Tech stack icons
const techStack = [
    { icon: Code2, label: 'TypeScript' },
    { icon: Bot, label: 'AI/ML' },
    { icon: Layers, label: 'React' },
    { icon: Database, label: 'PostgreSQL' },
    { icon: Terminal, label: 'Python' },
    { icon: Zap, label: 'FastAPI' },
];

export default function LandingPage() {
    const heroVisible = useHeroEntrance(4, 100);
    const { ref: statsRef, isRevealed: statsVisible } = useScrollReveal();
    const { containerRef: cardsRef, revealedItems: cardsVisible } = useStaggeredReveal(accomplishments.length, { staggerDelay: 100 });
    const { ref: linksRef, isRevealed: linksVisible } = useScrollReveal();
    const { ref: techRef, isRevealed: techVisible } = useScrollReveal();

    return (
        <div className="landing-minimal">
            {/* Hero - Name + Role */}
            <header className="hero-minimal">
                <div className={`hero-name ${heroVisible[0] ? 'visible' : ''}`}>
                    <h1>Isaac Hernandez</h1>
                </div>
                <p className={`hero-role ${heroVisible[1] ? 'visible' : ''}`}>
                    Software Engineer · System Designer · AI Architect
                </p>
                <p className={`hero-tagline ${heroVisible[2] ? 'visible' : ''}`}>
                    Building tools that think.
                </p>
                <div className={`hero-actions ${heroVisible[3] ? 'visible' : ''}`}>
                    <a href="https://github.com/isaacsight" target="_blank" rel="noopener noreferrer" className="action-icon">
                        <Github size={20} />
                    </a>
                    <a href="mailto:isaacsight@gmail.com" className="action-icon">
                        <Mail size={20} />
                    </a>
                </div>
            </header>

            {/* Stats Strip */}
            <section ref={statsRef} className={`stats-strip ${statsVisible ? 'visible' : ''}`}>
                {stats.map((stat, i) => (
                    <div key={i} className="stat-item">
                        <stat.icon size={16} className="stat-icon" />
                        <span className="stat-value">{stat.value}</span>
                        <span className="stat-label">{stat.label}</span>
                    </div>
                ))}
            </section>

            {/* Accomplishments Grid */}
            <section className="accomplishments">
                <div ref={cardsRef} className="accomplishments-grid">
                    {accomplishments.map((item, i) => (
                        <Link
                            key={i}
                            to={item.link}
                            className={`accomplishment-card ${cardsVisible[i] ? 'visible' : ''}`}
                        >
                            <div className="card-header">
                                <item.icon size={24} className="card-icon" />
                                <Zap size={14} className="card-spark" />
                            </div>
                            <h3 className="card-title">{item.title}</h3>
                            <span className="card-subtitle">{item.subtitle}</span>
                            <p className="card-desc">{item.description}</p>
                            <div className="card-tags">
                                {item.tags.map((tag, j) => (
                                    <span key={j} className="card-tag">{tag}</span>
                                ))}
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Tech Stack */}
            <section ref={techRef} className={`tech-stack ${techVisible ? 'visible' : ''}`}>
                <span className="tech-label">Stack</span>
                <div className="tech-icons">
                    {techStack.map((tech, i) => (
                        <div key={i} className="tech-item" title={tech.label}>
                            <tech.icon size={18} />
                        </div>
                    ))}
                </div>
            </section>

            {/* Quick Links */}
            <section ref={linksRef} className={`quick-links ${linksVisible ? 'visible' : ''}`}>
                {quickLinks.map((link, i) => (
                    <Link key={i} to={link.path} className="quick-link">
                        <link.icon size={18} />
                        <span className="quick-label">{link.label}</span>
                        {link.count && <span className="quick-count">{link.count}</span>}
                        <ArrowRight size={14} className="quick-arrow" />
                    </Link>
                ))}
            </section>

            {/* Footer */}
            <footer className="footer-minimal">
                <p>Building in public · 2025–2026</p>
            </footer>
        </div>
    );
}

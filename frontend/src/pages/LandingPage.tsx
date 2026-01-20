import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import LandingHero from '../components/landing/LandingHero';
import { useScrollReveal, useStaggeredReveal } from '../hooks/useScrollReveal';
import './LandingPage.css';

interface Project {
    title: string;
    description: string;
    tags: string[];
    featured?: boolean;
}

const featuredProjects: Project[] = [
    {
        title: "Sovereign Laboratory OS",
        description: "A cognitive architecture for building permanent thinking systems. Multi-agent swarm with 46+ specialized modules for design intelligence, answer engines, and memory management.",
        tags: ["Python", "FastAPI", "React", "Multi-Agent"],
        featured: true,
    },
    {
        title: "Director",
        description: "Automated video pipeline orchestrating CapCut, TikTok, and content distribution. Systems thinking applied to content creation.",
        tags: ["Python", "Automation", "API Integration"],
    },
    {
        title: "Does This Feel Right",
        description: "This portfolio itself—a contemplative design system exploring literary minimalism in digital interfaces. Built with React 19 and the Rubin aesthetic.",
        tags: ["React", "TypeScript", "Design Systems"],
    }
];

const philosophyItems = [
    {
        title: "Systems over Features",
        description: "Every project is an opportunity to build something that compounds. Not just solving the immediate problem, but creating frameworks that make future problems easier."
    },
    {
        title: "Craft over Speed",
        description: "Code is read more than it's written. I optimize for clarity, for the developer six months from now who needs to understand why something was built this way."
    },
    {
        title: "Feel over Function",
        description: "The best interfaces disappear. They don't demand attention—they create space for the work that matters. Does this feel right? That's the question."
    }
];

export default function LandingPage() {
    // Scroll reveal for section headers
    const { ref: featuredHeaderRef, isRevealed: featuredHeaderVisible } = useScrollReveal();
    const { ref: philosophyHeaderRef, isRevealed: philosophyHeaderVisible } = useScrollReveal();

    // Staggered reveal for project cards
    const { containerRef: projectsContainerRef, revealedItems: projectsRevealed } =
        useStaggeredReveal(featuredProjects.length, { staggerDelay: 150 });

    // Staggered reveal for philosophy items
    const { containerRef: philosophyContainerRef, revealedItems: philosophyRevealed } =
        useStaggeredReveal(philosophyItems.length, { staggerDelay: 120 });

    // Footer reveal
    const { ref: footerRef, isRevealed: footerVisible } = useScrollReveal();
    const { ref: ctaRef, isRevealed: ctaVisible } = useScrollReveal();

    return (
        <div className="landing-page">
            <LandingHero />

            <section className="featured-section">
                <div
                    ref={featuredHeaderRef}
                    className={`section-header ${featuredHeaderVisible ? 'revealed' : ''}`}
                >
                    <span className="section-number">01</span>
                    <h2 className="section-title">Selected Work</h2>
                    <p className="section-description">
                        Projects that represent how I think about systems, interfaces, and craft.
                    </p>
                </div>

                <div ref={projectsContainerRef} className="projects-grid">
                    {featuredProjects.map((project, index) => (
                        <article
                            key={index}
                            className={`project-card card-interactive ${project.featured ? 'featured' : ''} ${projectsRevealed[index] ? 'revealed' : ''}`}
                        >
                            <div className="project-meta">
                                <span className="project-index">
                                    {(index + 1).toString().padStart(2, '0')}
                                </span>
                            </div>
                            <h3 className="project-title">{project.title}</h3>
                            <p className="project-description">{project.description}</p>
                            <div className="project-tags">
                                {project.tags.map((tag, i) => (
                                    <span key={i} className="project-tag tag-interactive">{tag}</span>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>

                <div
                    ref={ctaRef}
                    className={`section-cta ${ctaVisible ? 'revealed' : ''}`}
                >
                    <Link to="/projects" className="cta-link btn-interactive">
                        <span>View all projects</span>
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            <section className="philosophy-section">
                <div
                    ref={philosophyHeaderRef}
                    className={`section-header ${philosophyHeaderVisible ? 'revealed' : ''}`}
                >
                    <span className="section-number">02</span>
                    <h2 className="section-title">The Way I Work</h2>
                </div>

                <div ref={philosophyContainerRef} className="philosophy-grid">
                    {philosophyItems.map((item, index) => (
                        <div
                            key={index}
                            className={`philosophy-item ${philosophyRevealed[index] ? 'revealed' : ''}`}
                        >
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            <footer
                ref={footerRef}
                className={`landing-footer ${footerVisible ? 'revealed' : ''}`}
            >
                <div className="footer-content">
                    <p className="footer-tagline">
                        Building tools that feel right.
                    </p>
                    <div className="footer-links">
                        <a
                            href="https://github.com/isaacsight"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="footer-link hover-underline"
                        >
                            GitHub
                        </a>
                        <span className="footer-divider">·</span>
                        <a
                            href="mailto:hello@doesthisfeelright.com"
                            className="footer-link hover-underline"
                        >
                            Contact
                        </a>
                        <span className="footer-divider">·</span>
                        <Link to="/about" className="footer-link hover-underline">
                            About
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

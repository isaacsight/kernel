import { Link } from 'react-router-dom';
import { ArrowRight, Star, GitFork } from 'lucide-react';
import LandingHero from '../components/landing/LandingHero';
import './LandingPage.css';

interface Project {
    title: string;
    description: string;
    tags: string[];
    stars?: number;
    forks?: number;
    link: string;
    featured?: boolean;
}

const featuredProjects: Project[] = [
    {
        title: "Sovereign Laboratory OS",
        description: "A cognitive architecture for building permanent thinking systems. Multi-agent swarm with 46+ specialized modules for design intelligence, answer engines, and memory management.",
        tags: ["Python", "FastAPI", "React", "Multi-Agent"],
        featured: true,
        link: "https://github.com/isaachernandez/sovereign-lab"
    },
    {
        title: "Director",
        description: "Automated video pipeline orchestrating CapCut, TikTok, and content distribution. Systems thinking applied to content creation.",
        tags: ["Python", "Automation", "API Integration"],
        link: "https://github.com/isaachernandez/director"
    },
    {
        title: "Does This Feel Right",
        description: "This portfolio itself—a contemplative design system exploring literary minimalism in digital interfaces. Built with React 19 and the Rubin aesthetic.",
        tags: ["React", "TypeScript", "Design Systems"],
        link: "https://github.com/isaachernandez/blog-design"
    }
];

export default function LandingPage() {
    return (
        <div className="landing-page">
            <LandingHero />

            <section className="featured-section">
                <div className="section-header">
                    <span className="section-number">01</span>
                    <h2 className="section-title">Selected Work</h2>
                    <p className="section-description">
                        Projects that represent how I think about systems, interfaces, and craft.
                    </p>
                </div>

                <div className="projects-grid">
                    {featuredProjects.map((project, index) => (
                        <a
                            key={index}
                            href={project.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`project-card ${project.featured ? 'featured' : ''}`}
                        >
                            <div className="project-meta">
                                <span className="project-index">
                                    {(index + 1).toString().padStart(2, '0')}
                                </span>
                                {project.stars && (
                                    <span className="project-stat">
                                        <Star size={14} />
                                        {project.stars}
                                    </span>
                                )}
                                {project.forks && (
                                    <span className="project-stat">
                                        <GitFork size={14} />
                                        {project.forks}
                                    </span>
                                )}
                            </div>
                            <h3 className="project-title">{project.title}</h3>
                            <p className="project-description">{project.description}</p>
                            <div className="project-tags">
                                {project.tags.map((tag, i) => (
                                    <span key={i} className="project-tag">{tag}</span>
                                ))}
                            </div>
                        </a>
                    ))}
                </div>

                <div className="section-cta">
                    <Link to="/projects" className="cta-link">
                        <span>View all projects</span>
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            <section className="philosophy-section">
                <div className="section-header">
                    <span className="section-number">02</span>
                    <h2 className="section-title">The Way I Work</h2>
                </div>

                <div className="philosophy-grid">
                    <div className="philosophy-item">
                        <h3>Systems over Features</h3>
                        <p>
                            Every project is an opportunity to build something that compounds.
                            Not just solving the immediate problem, but creating frameworks
                            that make future problems easier.
                        </p>
                    </div>
                    <div className="philosophy-item">
                        <h3>Craft over Speed</h3>
                        <p>
                            Code is read more than it's written. I optimize for clarity,
                            for the developer six months from now who needs to understand
                            why something was built this way.
                        </p>
                    </div>
                    <div className="philosophy-item">
                        <h3>Feel over Function</h3>
                        <p>
                            The best interfaces disappear. They don't demand attention—they
                            create space for the work that matters. Does this feel right?
                            That's the question.
                        </p>
                    </div>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="footer-content">
                    <p className="footer-tagline">
                        Building tools that feel right.
                    </p>
                    <div className="footer-links">
                        <a href="https://github.com/isaachernandez" target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                        <span className="footer-divider">·</span>
                        <a href="mailto:hello@doesthisfeelright.com">
                            Contact
                        </a>
                        <span className="footer-divider">·</span>
                        <Link to="/about">
                            About
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

import { Github, ExternalLink, Star, GitFork, Calendar } from 'lucide-react';
import './ProjectsPage.css';

interface Project {
    title: string;
    description: string;
    longDescription?: string;
    tags: string[];
    stars?: number;
    forks?: number;
    link: string;
    demo?: string;
    year: string;
    status: 'active' | 'maintained' | 'archived';
}

const allProjects: Project[] = [
    {
        title: "Sovereign Laboratory OS",
        description: "Cognitive architecture for permanent thinking systems",
        longDescription: "A multi-agent swarm with 46+ specialized modules. Design intelligence scrapers, answer engines with semantic search, memory management with pgvector embeddings. The system compounds knowledge over time—every interaction leaves residue.",
        tags: ["Python", "FastAPI", "React", "PostgreSQL", "Multi-Agent", "pgvector"],
        year: "2024",
        status: "active",
        link: "https://github.com/isaachernandez/sovereign-lab"
    },
    {
        title: "Director",
        description: "Automated video content pipeline",
        longDescription: "Orchestrates CapCut for editing, TikTok for distribution, and custom APIs for automation. Systems thinking applied to content creation—turning manual workflows into programmatic pipelines.",
        tags: ["Python", "CapCut API", "TikTok API", "Automation"],
        year: "2024",
        status: "active",
        link: "https://github.com/isaachernandez/director"
    },
    {
        title: "Does This Feel Right",
        description: "Contemplative portfolio design system",
        longDescription: "This portfolio itself. An exploration of literary minimalism in digital interfaces—serif typography, generous whitespace, and the Rubin aesthetic. Built with React 19, TypeScript, and Vite.",
        tags: ["React 19", "TypeScript", "Vite", "Design Systems", "CSS"],
        year: "2024",
        status: "active",
        link: "https://github.com/isaachernandez/blog-design",
        demo: "https://doesthisfeelright.com"
    },
    {
        title: "Mobbin Scout",
        description: "Design intelligence research agent",
        longDescription: "Playwright-based scraper for extracting mobile app design patterns from Mobbin.com. Stores findings in Supabase with structured schemas for apps, screens, and flows. Respects robots.txt with ethical rate limiting.",
        tags: ["Python", "Playwright", "BeautifulSoup4", "Supabase"],
        year: "2024",
        status: "maintained",
        link: "https://github.com/isaachernandez/mobbin-scout"
    },
    {
        title: "Titan DB",
        description: "Visual database exploration tool",
        longDescription: "Interactive interface for exploring and visualizing database schemas and relationships. Built for understanding complex data architectures at a glance.",
        tags: ["React", "TypeScript", "D3.js", "PostgreSQL"],
        year: "2023",
        status: "maintained",
        link: "https://github.com/isaachernandez/titan-db"
    },
    {
        title: "Answer Engine",
        description: "Semantic search infrastructure",
        longDescription: "Search infrastructure using pgvector for semantic embeddings. Converts natural language queries into vector searches across document collections. Part of the Sovereign Lab ecosystem.",
        tags: ["Python", "pgvector", "OpenAI", "FastAPI"],
        year: "2023",
        status: "maintained",
        link: "https://github.com/isaachernandez/answer-engine"
    }
];

const statusLabels = {
    active: "Active Development",
    maintained: "Maintained",
    archived: "Archived"
};

export default function ProjectsPage() {
    return (
        <div className="projects-page">
            <header className="projects-header">
                <h1 className="page-title">Projects</h1>
                <p className="page-description">
                    A collection of systems, tools, and experiments.
                    Each one represents a different way of thinking about software.
                </p>
                <a
                    href="https://github.com/isaachernandez"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="github-link"
                >
                    <Github size={18} />
                    <span>View all on GitHub</span>
                </a>
            </header>

            <main className="projects-list">
                {allProjects.map((project, index) => (
                    <article key={index} className="project-item">
                        <div className="project-header">
                            <div className="project-meta">
                                <span className="project-year">
                                    <Calendar size={14} />
                                    {project.year}
                                </span>
                                <span className={`project-status status-${project.status}`}>
                                    {statusLabels[project.status]}
                                </span>
                            </div>
                            <div className="project-stats">
                                {project.stars && (
                                    <span className="stat">
                                        <Star size={14} />
                                        {project.stars}
                                    </span>
                                )}
                                {project.forks && (
                                    <span className="stat">
                                        <GitFork size={14} />
                                        {project.forks}
                                    </span>
                                )}
                            </div>
                        </div>

                        <h2 className="project-title">{project.title}</h2>
                        <p className="project-subtitle">{project.description}</p>
                        <p className="project-description">{project.longDescription}</p>

                        <div className="project-tags">
                            {project.tags.map((tag, i) => (
                                <span key={i} className="tag">{tag}</span>
                            ))}
                        </div>

                        <div className="project-links">
                            <a
                                href={project.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="project-link"
                            >
                                <Github size={16} />
                                <span>Source</span>
                            </a>
                            {project.demo && (
                                <a
                                    href={project.demo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="project-link"
                                >
                                    <ExternalLink size={16} />
                                    <span>Live Demo</span>
                                </a>
                            )}
                        </div>
                    </article>
                ))}
            </main>
        </div>
    );
}

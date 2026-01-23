import { useScrollReveal, useStaggeredReveal } from '../hooks/useScrollReveal';
import './ConsultingPage.css';

interface Service {
    title: string;
    description: string;
    scope: string[];
}

const services: Service[] = [
    {
        title: 'AI Systems Architecture',
        description: 'Design and implementation of multi-agent systems, from prototype to production. I help organizations build AI that actually works.',
        scope: ['Agent orchestration', 'RAG pipelines', 'Custom fine-tuning', 'MLOps infrastructure']
    },
    {
        title: 'Technical Strategy',
        description: 'Fractional CTO services for startups and scale-ups navigating AI adoption. Clear thinking on complex technical decisions.',
        scope: ['Technology roadmaps', 'Build vs. buy analysis', 'Team structure', 'Vendor evaluation']
    },
    {
        title: 'Full-Stack Development',
        description: 'End-to-end product development with modern tooling. React, TypeScript, Python, Go—whatever the problem requires.',
        scope: ['Web applications', 'API design', 'Database architecture', 'Performance optimization']
    },
    {
        title: 'AI Engineering Training',
        description: 'Workshops and hands-on training for engineering teams. Build real AI features, not just understand concepts.',
        scope: ['Prompt engineering', 'Agent development', 'LLM integration', 'Evaluation frameworks']
    },
];

export default function ConsultingPage() {
    const { ref: headerRef, isRevealed: headerVisible } = useScrollReveal();
    const { containerRef: servicesRef, revealedItems: servicesRevealed } = useStaggeredReveal(services.length, { staggerDelay: 150 });
    const { ref: ctaRef, isRevealed: ctaVisible } = useScrollReveal();

    return (
        <div className="consulting-page">
            <header
                ref={headerRef}
                className={`consulting-header ${headerVisible ? 'revealed' : ''}`}
            >
                <span className="consulting-number">Services</span>
                <h1 className="consulting-title">Consulting</h1>
                <p className="consulting-intro">
                    I help companies build AI systems that work. Not demos—real systems that create value.
                </p>
            </header>

            <section ref={servicesRef} className="services-section">
                {services.map((service, index) => (
                    <article
                        key={service.title}
                        className={`service-card ${servicesRevealed[index] ? 'revealed' : ''}`}
                    >
                        <div className="service-index">0{index + 1}</div>
                        <h2 className="service-title">{service.title}</h2>
                        <p className="service-description">{service.description}</p>
                        <ul className="service-scope">
                            {service.scope.map(item => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </article>
                ))}
            </section>

            <section
                ref={ctaRef}
                className={`consulting-cta ${ctaVisible ? 'revealed' : ''}`}
            >
                <h2>Let's Talk</h2>
                <p>
                    The best projects start with a conversation. Tell me what you're building,
                    and I'll tell you if I can help.
                </p>
                <a href="mailto:isaacsight@gmail.com" className="cta-button">
                    Get in touch →
                </a>
            </section>

            <section className="consulting-philosophy">
                <blockquote>
                    "The goal isn't to use AI. The goal is to build things that matter.
                    AI is just a tool—often the right one, sometimes not."
                </blockquote>
            </section>
        </div>
    );
}

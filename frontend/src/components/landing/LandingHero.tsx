import { Github, Mail, MapPin } from 'lucide-react';
import { useHeroEntrance } from '../../hooks/useScrollReveal';
import './LandingHero.css';

export default function LandingHero() {
    // Staggered entrance animation for hero elements
    const visible = useHeroEntrance(6, 120);

    return (
        <section className="landing-hero">
            <div className="hero-content">
                <p className={`hero-greeting ${visible[0] ? 'visible' : ''}`}>
                    Hello, I'm
                </p>

                <h1 className={`hero-title ${visible[1] ? 'visible' : ''}`}>
                    <span className="hero-title-line">Isaac</span>
                    <span className="hero-title-line">Hernandez</span>
                </h1>

                <p className={`hero-subtitle ${visible[2] ? 'visible' : ''}`}>
                    Software Engineer <span className="ampersand">&</span> System Designer
                </p>

                <p className={`hero-philosophy ${visible[3] ? 'visible' : ''}`}>
                    I build tools that feel right. Systems that breathe.
                    <br />
                    Code as craft, not just function.
                </p>

                <div className={`hero-links ${visible[4] ? 'visible' : ''}`}>
                    <a
                        href="https://github.com/isaacsight"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hero-link btn-interactive"
                    >
                        <Github size={20} />
                        <span>GitHub</span>
                    </a>
                    <a
                        href="mailto:hello@doesthisfeelright.com"
                        className="hero-link btn-interactive"
                    >
                        <Mail size={20} />
                        <span>Contact</span>
                    </a>
                </div>

                <div className={`hero-location ${visible[5] ? 'visible' : ''}`}>
                    <MapPin size={16} />
                    <span>Building in public</span>
                </div>
            </div>

            {/* Scroll indicator */}
            <div className={`scroll-indicator ${visible[5] ? 'visible' : ''}`}>
                <div className="scroll-line"></div>
            </div>
        </section>
    );
}

import { Github, Mail, MapPin } from 'lucide-react';
import './LandingHero.css';

export default function LandingHero() {
    return (
        <section className="landing-hero">
            <div className="hero-content">
                <p className="hero-greeting">Hello, I'm</p>
                <h1 className="hero-title">Isaac Hernandez</h1>
                <p className="hero-subtitle">Software Engineer & System Designer</p>

                <p className="hero-philosophy">
                    I build tools that feel right. Systems that breathe.
                    Code as craft, not just function.
                </p>

                <div className="hero-links">
                    <a
                        href="https://github.com/isaachernandez"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hero-link"
                    >
                        <Github size={20} />
                        <span>GitHub</span>
                    </a>
                    <a
                        href="mailto:hello@doesthisfeelright.com"
                        className="hero-link"
                    >
                        <Mail size={20} />
                        <span>Contact</span>
                    </a>
                </div>

                <div className="hero-location">
                    <MapPin size={16} />
                    <span>Building in public</span>
                </div>
            </div>
        </section>
    );
}

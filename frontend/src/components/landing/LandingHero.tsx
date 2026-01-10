import './LandingHero.css';

export default function LandingHero() {
    return (
        <section className="landing-hero">
            <div className="hero-content">
                <h1 className="hero-title">The Way of Code</h1>
                <p className="hero-subtitle">The Timeless Art of Vibe Coding</p>
                <p className="hero-attribution">Based on Lao Tzu / Adapted by Rick Rubin</p>

                <blockquote className="hero-quote">
                    "The journey of a thousand miles begins with a single line of code,
                    not as an instruction, but as an intention."
                </blockquote>
            </div>
        </section>
    );
}

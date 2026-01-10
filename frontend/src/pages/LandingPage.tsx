import ArtworkContainer from '../components/layout/ArtworkContainer';
import ProseContainer from '../components/layout/ProseContainer';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
    return (
        <div className="landing-page">
            <section className="hero-section">
                <h1 className="hero-title">Does This Feel Right</h1>
                <p className="hero-subtitle">System Compiler for the Solo Founder</p>
            </section>

            <ArtworkContainer variant="flow" />

            <ProseContainer>
                <div className="landing-intro">
                    <p>
                        We are building a new kind of operating system. One that treats code as literature
                        and software as a garden. It is not about efficiency, but about clarity, flow, and
                        the feeling of rightness.
                    </p>
                    <p>
                        This is an exploration of the intersection between artificial intelligence,
                        system design, and human intuition.
                    </p>
                </div>
            </ProseContainer>

            <ArtworkContainer variant="duality" />

            <ProseContainer>
                <div className="featured-essays">
                    <h2>Recent Thoughts</h2>
                    <ul className="essay-list-simple">
                        <li>
                            <Link to="/essays/native-coding">Native Coding</Link>
                            <span className="date">2025-12-01</span>
                        </li>
                        <li>
                            <Link to="/essays/the-system-compiler">The System Compiler</Link>
                            <span className="date">2025-11-15</span>
                        </li>
                        <li>
                            <Link to="/essays/warm-computing">Warm Computing</Link>
                            <span className="date">2025-10-22</span>
                        </li>
                    </ul>
                </div>
            </ProseContainer>
        </div>
    );
}

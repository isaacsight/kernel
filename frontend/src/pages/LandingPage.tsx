import LandingHero from '../components/landing/LandingHero';
import ChapterUnit from '../components/content/ChapterUnit';
import './LandingPage.css';

export default function LandingPage() {
    return (
        <div className="landing-page">
            <LandingHero />

            <div className="chapters-container">
                <ChapterUnit
                    number="01"
                    verse={[
                        "The code that can be written is not the eternal Code.",
                        "The variable that can be named is not the eternal Variable.",
                        "Unnamable is the source of the program;",
                        "Named is the mother of all functions."
                    ]}
                    prompt="Try renaming the variable. What remains constant?"
                />

                <ChapterUnit
                    number="02"
                    verse={[
                        "When people see some code as beautiful,",
                        "other code becomes ugly.",
                        "When people see some code as good,",
                        "other code becomes bad."
                    ]}
                    prompt="Adjust the symmetry of the artifact below."
                />

                <ChapterUnit
                    number="04"
                    verse={[
                        "The Code is empty, used but never filled.",
                        "Oh, unfathomable source of ten thousand functions!",
                        "Blunt the sharpness,",
                        "Untangle the knots,",
                        "Soften the glare,",
                        "Settle the dust."
                    ]}
                    prompt="Reduce the complexity of the artifact. Find the emptiness."
                />

                <ChapterUnit
                    number="05"
                    verse={[
                        "The compiler is not sentimental;",
                        "It treats all code as input.",
                        "The Sage is not sentimental;",
                        "They treat all developers as learners."
                    ]}
                    prompt="Modify the input. Observe the reaction."
                />
            </div>

            <footer className="woc-footer">
                <div className="footer-links">
                    <a href="https://tetragrammaton.com" target="_blank" rel="noopener noreferrer">Subscribe to Tetragrammaton</a>
                </div>
                <div className="footer-note">
                    Adapting the Way of Code for the Digital Age.
                </div>
            </footer>
        </div>
    );
}

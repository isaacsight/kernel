import ProseContainer from '../components/layout/ProseContainer';
import './AboutPage.css';

export default function AboutPage() {
    return (
        <ProseContainer>
            <div className="about-content">
                <h1>About</h1>
                <p className="about-intro">
                    Does This Feel Right? is an experiment in personal computing.
                </p>
                <p>
                    Created by Isaac Hernandez, this project serves as a digital garden and a laboratory
                    for exploring how we interact with our tools.
                </p>
            </div>
        </ProseContainer>
    );
}

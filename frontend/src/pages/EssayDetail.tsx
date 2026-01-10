// import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import ProseContainer from '../components/layout/ProseContainer';
import ArtworkContainer from '../components/layout/ArtworkContainer';
import ReactMarkdown from 'react-markdown';
import './EssayDetail.css';

export default function EssayDetail() {
    // const { slug } = useParams(); // params available if needed for fetching

    // Placeholder content - in a real app this would fetch based on slug
    const markdownContent = `
# The Feeling of Rightness

Software is not just logic; it is a feeling. When we write code, we are sculpting logic into a form that interacts with human intuition.

## The Glass Wall

Modern interfaces feel like cold glass. They are efficient, frictionless, and utterly devoid of texture. We slide our fingers across screens that offer no resistance, no warmth.

## Returning to Clay

We need to return to the clay. To software that feels like it has weight, that invites us to mold it.
    `;

    return (
        <article className="essay-detail">
            <ProseContainer>
                <div className="essay-nav">
                    <Link to="/essays">← Index</Link>
                </div>
                <header className="entry-header">
                    <span className="entry-date">2026-01-09</span>
                    <h1 className="entry-title">Native Coding</h1>
                    <p className="entry-subtitle">Writing code that feels like it belongs.</p>
                </header>
            </ProseContainer>

            <ArtworkContainer variant="emergence" />

            <ProseContainer>
                <div className="markdown-content">
                    <ReactMarkdown>{markdownContent}</ReactMarkdown>
                </div>
            </ProseContainer>
        </article>
    );
}

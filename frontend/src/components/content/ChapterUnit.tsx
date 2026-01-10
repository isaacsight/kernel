import { type ReactNode } from 'react';
import './ChapterUnit.css';

interface ChapterUnitProps {
    number: string;
    verse: string[];
    artifact?: ReactNode;
    prompt?: string;
}

export default function ChapterUnit({ number, verse, artifact, prompt }: ChapterUnitProps) {
    return (
        <section className="chapter-unit" id={`chapter-${number}`}>
            <div className="chapter-header">
                <span className="chapter-number">{number}</span>
            </div>

            <div className="chapter-verse">
                {verse.map((line, i) => (
                    <p key={i}>{line}</p>
                ))}
            </div>

            <div className="chapter-artifact">
                {artifact || <div className="artifact-placeholder" />}
            </div>

            {prompt && (
                <div className="chapter-prompt">
                    <textarea
                        className="prompt-input"
                        placeholder={prompt}
                        rows={1}
                        onChange={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                    />
                    <button className="modify-button">Modify</button>
                </div>
            )}
        </section>
    );
}

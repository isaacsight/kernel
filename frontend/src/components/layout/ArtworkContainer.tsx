import './ArtworkContainer.css';

interface ArtworkContainerProps {
    variant?: 'duality' | 'emergence' | 'flow';
}

export default function ArtworkContainer({ variant = 'flow' }: ArtworkContainerProps) {
    return (
        <div className={`artwork-container artwork-${variant}`}>
            <div className="artwork-placeholder">
                {/* Generative art hook will go here */}
                <span className="artwork-label">{variant}</span>
            </div>
        </div>
    );
}

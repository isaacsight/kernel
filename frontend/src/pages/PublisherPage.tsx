import Publisher from '../components/Publisher';

const PublisherPage = () => {
    return (
        <div className="main-content" style={{ padding: '2rem 0' }}>
            <div className="prose-container">
                <div className="text-center" style={{ marginBottom: '3rem' }}>
                    <h1 style={{ marginBottom: '1rem' }}>Control Center</h1>
                    <p>Direct access to the Alchemist's publication engine.</p>
                </div>
                <Publisher />
            </div>
        </div>
    );
};

export default PublisherPage;

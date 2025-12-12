import ClientChatWidget from '../components/Chat/ClientChatWidget';

export default function ClientPortal() {
    return (
        <div className="page-container" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            gap: '2rem'
        }}>
            <header style={{ textAlign: 'center' }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    marginBottom: '1rem',
                    background: 'linear-gradient(45deg, #4ec9b0, #007acc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    Client Portal
                </h1>
                <p style={{ color: '#888', maxWidth: '500px' }}>
                    Welcome to our automated service desk. Use the chat below to get instant quotes, explore our services, or check project capability.
                </p>
            </header>

            <ClientChatWidget />
        </div >
    );
}

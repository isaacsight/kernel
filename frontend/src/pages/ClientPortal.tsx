import ClientChatWidget from '../components/Chat/ClientChatWidget';
import ProseContainer from '../components/layout/ProseContainer';
import './ClientPortal.css';

export default function ClientPortal() {
    return (
        <ProseContainer className="client-portal">
            <header className="portal-header">
                <h1>Client Portal</h1>
                <p>
                    Welcome to our automated service desk. Use the chat below to get instant quotes, explore our services, or check project capability.
                </p>
            </header>

            <div className="chat-widget-wrapper">
                <ClientChatWidget />
            </div>
        </ProseContainer>
    );
}

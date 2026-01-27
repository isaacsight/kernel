import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';

// Pages
import LandingPage from './pages/LandingPage';
import ProjectsPage from './pages/ProjectsPage';
import AboutPage from './pages/AboutPage';
import EssaysPage from './pages/EssaysPage';
import ConsultingPage from './pages/ConsultingPage';
import CommandCenter from './pages/CommandCenter';
import CodexPage from './pages/CodexPage';
import AlchemistForge from './pages/AlchemistForge';
import PublisherPage from './pages/PublisherPage';
import FishingGame from './pages/FishingGame';

// Layout wrapper that conditionally shows navigation
function AppLayout() {
    const location = useLocation();
    const isCommandCenter = location.pathname === '/command' || location.pathname === '/rts';

    // Command Center has its own full-page layout
    if (isCommandCenter) {
        return <CommandCenter />;
    }

    // Standard layout with navigation
    return (
        <div className="rubin-app">
            <Navigation />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/essays" element={<EssaysPage />} />
                    <Route path="/consulting" element={<ConsultingPage />} />
                    <Route path="*" element={<LandingPage />} />
                </Routes>
            </main>
        </div>
    );
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/command" element={<CommandCenter />} />
                <Route path="/rts" element={<CommandCenter />} />
                <Route path="/codex" element={<CodexPage />} />
                <Route path="/forge" element={<AlchemistForge />} />
                <Route path="/publish" element={<PublisherPage />} />
                <Route path="/fishing" element={<FishingGame />} />
                <Route path="/fish" element={<FishingGame />} />
                <Route path="/*" element={<AppLayout />} />
            </Routes>
        </Router>
    );
}

export default App;

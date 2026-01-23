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
import Battlefield from './pages/Battlefield';
import WarcraftEngine from './pages/WarcraftEngine';
import AlchemistForge from './pages/AlchemistForge';

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
                <Route path="/battle" element={<Battlefield />} />
                <Route path="/battlefield" element={<Battlefield />} />
                <Route path="/warcraft" element={<WarcraftEngine />} />
                <Route path="/rts-engine" element={<WarcraftEngine />} />
                <Route path="/forge" element={<AlchemistForge />} />
                <Route path="/*" element={<AppLayout />} />
            </Routes>
        </Router>
    );
}

export default App;

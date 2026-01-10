import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ChapterNav from './components/layout/ChapterNav';
import Shell from './components/layout/Shell';

// New Pages
import LandingPage from './pages/LandingPage';
import EssaysPage from './pages/EssaysPage';
import EssayDetail from './pages/EssayDetail';
import AboutPage from './pages/AboutPage';

// Legacy Pages (to be refactored or kept for functionality)
import StudioChat from './pages/StudioChat';
import ClientPortal from './pages/ClientPortal';
import IntelligenceConsole from './pages/IntelligenceConsole';
import TitanDB from './pages/TitanDB';
import ProjectPlaceholder from './pages/ProjectPlaceholder';

function App() {
  return (
    <Router>
      <div className="rubin-app">
        <ChapterNav />
        <Routes>
          {/* New Routes */}
          <Route path="/" element={<Shell variant="full"><LandingPage /></Shell>} />
          <Route path="/essays" element={<Shell variant="prose"><EssaysPage /></Shell>} />
          <Route path="/essays/:slug" element={<Shell variant="article"><EssayDetail /></Shell>} />
          <Route path="/about" element={<Shell variant="prose"><AboutPage /></Shell>} />

          {/* Legacy Routes - Wrapped in Shell for consistency */}
          <Route path="/chat" element={<Shell variant="full"><StudioChat /></Shell>} />
          <Route path="/intelligence" element={<Shell variant="full"><IntelligenceConsole /></Shell>} />
          <Route path="/clients" element={<Shell variant="full"><ClientPortal /></Shell>} />
          <Route path="/projects/titan" element={<Shell variant="full"><TitanDB /></Shell>} />
          <Route path="/projects/:id" element={<Shell variant="full"><ProjectPlaceholder /></Shell>} />

          {/* Fallback */}
          <Route path="*" element={<Shell variant="full"><LandingPage /></Shell>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

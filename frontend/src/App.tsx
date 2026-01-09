import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WayHeader from './components/layout/WayHeader';
import WayHomepage from './pages/WayHomepage';
import PhilosophyPage from './pages/PhilosophyPage';
import ProjectHub from './pages/ProjectHub';
import TitanDB from './pages/TitanDB';
import ProjectPlaceholder from './pages/ProjectPlaceholder';
import StudioChat from './pages/StudioChat';
import ClientPortal from './pages/ClientPortal';
import IntelligenceConsole from './pages/IntelligenceConsole';
import Shell from './components/layout/Shell';


import { Theme } from '@carbon/react';

/**
 * The Way of Code Application
 *
 * Rebuilt through the vision of vibe coding and wu wei.
 * Every route flows naturally. Every component breathes.
 */
function App() {
  return (
    <Theme theme="white">
      <Router>
        <div className="app-container">
          <WayHeader />
          <main>
            <Routes>
              {/* The Way Pages - Contemplative */}
              <Route path="/" element={<WayHomepage />} />
              <Route path="/philosophy" element={<PhilosophyPage />} />

              {/* Legacy Pages - Coexisting with The Way */}
              <Route path="/projects" element={
                <Shell mode="bento">
                  <ProjectHub />
                </Shell>
              } />
              <Route path="/chat" element={
                <Shell mode="bento">
                  <StudioChat />
                </Shell>
              } />
              <Route path="/intelligence" element={
                <Shell mode="bento">
                  <IntelligenceConsole />
                </Shell>
              } />
              <Route path="/clients" element={
                <Shell mode="bento">
                  <ClientPortal />
                </Shell>
              } />
              <Route path="/projects/titan" element={
                <Shell mode="bento">
                  <TitanDB />
                </Shell>
              } />
              <Route path="/projects/:id" element={
                <Shell mode="bento">
                  <ProjectPlaceholder />
                </Shell>
              } />

              {/* Fallback */}
              <Route path="*" element={<WayHomepage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </Theme>
  );
}

export default App;

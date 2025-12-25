import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import ProjectHub from './pages/ProjectHub';
import TitanDB from './pages/TitanDB';
import ProjectPlaceholder from './pages/ProjectPlaceholder';
import StudioChat from './pages/StudioChat';
import ClientPortal from './pages/ClientPortal';
import IntelligenceConsole from './pages/IntelligenceConsole';
import Shell from './components/layout/Shell';


function App() {
  return (
    <Router>
      <div className="app-container">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={
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
            <Route path="*" element={
              <Shell mode="bento">
                <ProjectHub />
              </Shell>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

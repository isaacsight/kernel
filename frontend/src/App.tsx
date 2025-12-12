import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import ProjectHub from './pages/ProjectHub';
import TitanDB from './pages/TitanDB';
import ProjectPlaceholder from './pages/ProjectPlaceholder';
import StudioChat from './pages/StudioChat';
import ClientPortal from './pages/ClientPortal';


function App() {
  return (
    <Router>
      <div className="app-container">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<ProjectHub />} />
            <Route path="/chat" element={<StudioChat />} />
            <Route path="/clients" element={<ClientPortal />} />
            <Route path="/projects/titan" element={<TitanDB />} />
            <Route path="/projects/:id" element={<ProjectPlaceholder />} />
            <Route path="*" element={<ProjectHub />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

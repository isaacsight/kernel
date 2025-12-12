
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MobileLayout from './components/MobileLayout';
import Home from './pages/Home';

import Studio from './pages/Studio';
import Settings from './pages/Settings';

const ScriptsPlaceholder = () => <div className="p-4 text-center text-[var(--text-muted)]">Scripts (Coming Soon)</div>;

function App() {
  return (
    <Router>
      <MobileLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/scripts" element={<ScriptsPlaceholder />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MobileLayout>
    </Router>
  );
}

export default App;


import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MobileLayout from './components/MobileLayout';
import Home from './pages/Home';

const StudioPlaceholder = () => <div className="p-4 text-center text-[var(--text-muted)]">Design Studio (Coming Soon)</div>;
const ScriptsPlaceholder = () => <div className="p-4 text-center text-[var(--text-muted)]">Scripts (Coming Soon)</div>;
const SettingsPlaceholder = () => <div className="p-4 text-center text-[var(--text-muted)]">Settings (Coming Soon)</div>;

function App() {
  return (
    <Router>
      <MobileLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/studio" element={<StudioPlaceholder />} />
          <Route path="/scripts" element={<ScriptsPlaceholder />} />
          <Route path="/settings" element={<SettingsPlaceholder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MobileLayout>
    </Router>
  );
}

export default App;

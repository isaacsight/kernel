import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PostList from './components/PostList';
import PostEditor from './components/PostEditor';
import DesignStudio from './components/DesignStudio';
import Settings from './components/Settings';
import ClientPortal from './components/ClientPortal';
import Consulting from './components/Consulting';
import RevenueDashboard from './components/RevenueDashboard';
import SynapticLattice from './components/SynapticLattice';
import ChatInterface from './components/ChatInterface';
import { ModeProvider } from './context/ModeContext';

function App() {
  return (
    <ModeProvider>
      <Router>
        <Routes>
          {/* Default entry point: Pure, distraction-free Agent Chat */}
          <Route path="/" element={<ChatInterface />} />

          {/* Nested routes that still use the Admin Layout shell */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="galaxy" element={<SynapticLattice />} />
                <Route path="legacy-dashboard" element={<Dashboard />} />
                <Route path="content" element={<PostList />} />
                <Route path="content/new" element={<PostEditor />} />
                <Route path="content/:slug" element={<PostEditor />} />
                <Route path="design" element={<DesignStudio />} />
                <Route path="revenue" element={<RevenueDashboard />} />
                <Route path="settings" element={<Settings />} />
                <Route path="consulting" element={<Consulting />} />
                {/* ClientPortal was removed from the instruction, so it's removed here */}
              </Routes>
            </Layout>
          } />
        </Routes>
      </Router>
    </ModeProvider>
  );
}

export default App;


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

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/content" element={<PostList />} />
          <Route path="/content/new" element={<PostEditor />} />
          <Route path="/content/:slug" element={<PostEditor />} />
          <Route path="/design" element={<DesignStudio />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/clients" element={<ClientPortal />} />
          <Route path="/consulting" element={<Consulting />} />
          <Route path="/revenue" element={<RevenueDashboard />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;


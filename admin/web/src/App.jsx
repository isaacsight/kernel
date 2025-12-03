import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PostList from './components/PostList';
import PostEditor from './components/PostEditor';
import Settings from './components/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/content" element={<PostList />} />
          <Route path="/content/new" element={<PostEditor />} />
          <Route path="/content/:slug" element={<PostEditor />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

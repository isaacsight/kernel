import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ModeProvider } from './context/ModeContext';

// Lazy load heavy components
const ChatInterface = lazy(() => import('./components/ChatInterface'));
const SynapticLattice = lazy(() => import('./components/SynapticLattice'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const PostList = lazy(() => import('./components/PostList'));
const PostEditor = lazy(() => import('./components/PostEditor'));
const DesignStudio = lazy(() => import('./components/DesignStudio'));
const RevenueDashboard = lazy(() => import('./components/RevenueDashboard'));
const FinanceDashboard = lazy(() => import('./components/FinanceDashboard'));
const Settings = lazy(() => import('./components/Settings'));
const Consulting = lazy(() => import('./components/Consulting'));
const CognitiveCockpit = lazy(() => import('./components/CognitiveCockpit'));
const NeuralLinkDashboard = lazy(() => import('./components/NeuralLinkDashboard'));
const StudioSimulation = lazy(() => import('./components/StudioSimulation'));

const LoadingScreen = () => (
  <div className="h-screen w-full bg-[#020202] flex flex-col items-center justify-center font-mono p-12">
    <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden mb-4 overflow-hidden">
      <div className="h-full bg-[#00D6A3] animate-[loading_2s_ease-in-out_infinite] w-[40%]" />
    </div>
    <div className="text-[10px] text-[#00D6A3] tracking-[0.5em] animate-pulse">
      UPLINKING_COGNITIVE_CORE...
    </div>
    <style>{`
      /* Sovereign Boot Sequence */
      @keyframes loading {
        0% { transform: translateX(-100%); opacity: 0; }
        50% { transform: translateX(0%); opacity: 1; }
        100% { transform: translateX(100%); opacity: 0; }
      }
      .font-sovereign { font-family: 'JetBrains Mono', monospace; }
    `}</style>
    <div className="absolute bottom-12 flex flex-col items-center gap-2">
      <div className="text-[9px] text-white/20 tracking-widest font-sovereign">ESTABLISHING NEURAL HANDSHAKE</div>
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-[#00D6A3] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1 h-1 bg-[#00D6A3] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1 h-1 bg-[#00D6A3] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div >
);

function App() {
  return (
    <ModeProvider>
      <Router>
        <Layout>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<CognitiveCockpit />} />
              <Route path="/chat" element={<ChatInterface />} />
              <Route path="/galaxy" element={<SynapticLattice />} />
              <Route path="/legacy-dashboard" element={<Dashboard />} />
              <Route path="/content" element={<PostList />} />
              <Route path="/content/new" element={<PostEditor />} />
              <Route path="/content/:slug" element={<PostEditor />} />
              <Route path="/design" element={<DesignStudio />} />
              <Route path="/revenue" element={<RevenueDashboard />} />
              <Route path="/finance" element={<FinanceDashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/consulting" element={<Consulting />} />
              <Route path="/neurallink" element={<NeuralLinkDashboard />} />
              <Route path="/simulation" element={<StudioSimulation />} />
              {/* Moved CognitiveCockpit to root */}
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </ModeProvider>
  );
}

export default App;


import { useState } from 'react';
import Workflow from './pages/Workflow';

function App() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-300 font-sans selection:bg-indigo-500/30">
      <Workflow />
    </div>
  );
}

export default App;

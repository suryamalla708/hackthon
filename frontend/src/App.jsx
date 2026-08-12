import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ApiMonitor from './pages/ApiMonitor';
import ErrorLogs from './pages/ErrorLogs';
import AiAnalysis from './pages/AiAnalysis';
import CodeFixes from './pages/CodeFixes';
import TestResults from './pages/TestResults';
import ApiPlayground from './pages/ApiPlayground';
import RepairHistory from './pages/RepairHistory';
import SettingsPage from './pages/Settings';
import GitHubImport from './pages/GitHubImport';
import { useRepairData } from './hooks/useRepairData';

const PAGES = {
  'dashboard':      Dashboard,
  'github-import':  GitHubImport,
  'api-monitor':    ApiMonitor,
  'error-logs':     ErrorLogs,
  'ai-analysis':    AiAnalysis,
  'code-fixes':     CodeFixes,
  'test-results':   TestResults,
  'api-playground': ApiPlayground,
  'repair-history': RepairHistory,
  'settings':       SettingsPage,
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const repairData = useRepairData();
  const PageComponent = PAGES[page] || Dashboard;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d1117' }}>
      <Sidebar activePage={page} onNavigate={setPage} failureCount={repairData.failures.length} />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <PageComponent onNavigate={setPage} repairData={repairData} />
      </main>
    </div>
  );
}

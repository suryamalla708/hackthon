import { Layers, Activity, FileText, Cpu, Code, CheckCircle, Terminal, Clock, Settings, Bot, ChevronRight, GitFork } from 'lucide-react';

const NAV = [
  { id: 'dashboard',      label: 'Dashboard',       icon: Layers },
  { id: 'github-import',  label: 'GitHub Import',   icon: GitFork },
  { id: 'api-monitor',    label: 'API Monitor',     icon: Activity },
  { id: 'error-logs',     label: 'Error Logs',      icon: FileText },
  { id: 'ai-analysis',    label: 'AI Analysis',     icon: Cpu },
  { id: 'code-fixes',     label: 'Code Fixes',      icon: Code },
  { id: 'test-results',   label: 'Test Results',    icon: CheckCircle },
  { id: 'api-playground', label: 'API Playground',  icon: Terminal },
  { id: 'repair-history', label: 'Repair History',  icon: Clock },
  { id: 'settings',       label: 'Settings',        icon: Settings },
];

export default function Sidebar({ activePage, onNavigate, failureCount = 0 }) {
  return (
    <aside style={{
      width: 240,
      minWidth: 240,
      background: '#010409',
      borderRight: '1px solid #21262d',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflowY: 'auto',
    }}>
      {/* Brand */}
      <div style={{
        padding: '20px 16px 18px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #1f6feb, #388bfd)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Bot size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.01em' }}>RepairAI</div>
          <div style={{ fontSize: 10, color: '#484f58', fontWeight: 500, letterSpacing: '0.03em', marginTop: 1 }}>PS-04 · AUTONOMOUS REPAIR</div>
        </div>
      </div>

      {/* Status dot */}
      <div style={{
        margin: '10px 16px',
        padding: '8px 10px',
        background: '#0e2d1e',
        border: '1px solid #1a4a30',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: '#34d399',
        fontWeight: 500,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
          boxShadow: '0 0 6px #22c55e',
          animation: 'pulse 2s infinite',
        }} />
        Agent online · Gemini 3.5 Flash
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 8px' }}>
        {NAV.map(item => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                marginBottom: 2,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#e6edf3' : '#8b949e',
                background: isActive ? '#1c2128' : 'transparent',
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#161b22'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', left: 0, top: 4, bottom: 4,
                  width: 3, borderRadius: '0 2px 2px 0',
                  background: '#1f6feb',
                }} />
              )}
              <Icon size={15} color={isActive ? '#58a6ff' : '#484f58'} />
              <span>{item.label}</span>
              {item.id === 'api-monitor' && failureCount > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: '#3d1c1c',
                  color: '#f87171',
                  border: '1px solid #5c2626',
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {failureCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #21262d',
        fontSize: 11,
        color: '#484f58',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>v1.0.4 · PS-04</span>
        <span style={{ color: '#1f6feb' }}>RepairAI</span>
      </div>
    </aside>
  );
}

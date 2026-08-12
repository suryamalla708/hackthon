import { Settings, Shield, Database, Activity, Bot, RefreshCw } from 'lucide-react';

const CONFIG_SECTIONS = [
  {
    title: 'AI Provider',
    icon: Bot,
    items: [
      { label: 'Provider', value: 'Google AI Studio', status: 'active' },
      { label: 'Model', value: 'gemini-3.5-flash', status: 'active' },
      { label: 'API Key', value: '••••••••••••••••••••••••••••••••••', status: 'configured', mono: true },
      { label: 'Temperature', value: '0.1 (precise)' },
      { label: 'Max Retries', value: '3 attempts per repair' },
      { label: 'Rate Limit', value: '20 req/day (free tier)' },
    ]
  },
  {
    title: 'Repair Pipeline',
    icon: RefreshCw,
    items: [
      { label: 'Max Attempts', value: '3' },
      { label: 'Patch Type', value: 'search/replace minimal patch' },
      { label: 'Workspace', value: './backend/backend_temp (isolated)' },
      { label: 'Auto-push to Git', value: 'DISABLED (safety)' },
      { label: 'Source Modification', value: 'NEVER (temp copy only)' },
      { label: 'Cleanup Policy', value: 'Auto-delete after test' },
    ]
  },
  {
    title: 'API Monitoring',
    icon: Activity,
    items: [
      { label: 'Failure Source', value: 'logs/code-locations.json' },
      { label: 'History Source', value: 'MongoDB via RepairHistory model' },
      { label: 'Monitored Endpoints', value: '6 routes (products + users)' },
      { label: 'Test Framework', value: 'Jest + Supertest' },
      { label: 'DB Memory Server', value: 'mongodb-memory-server' },
      { label: 'Auto Polling', value: 'Manual refresh (on-demand)' },
    ]
  },
  {
    title: 'Security',
    icon: Shield,
    items: [
      { label: 'API Key Exposure', value: 'NEVER (backend .env only)', status: 'safe' },
      { label: 'Temp Workspace', value: 'Path-validated, sandboxed' },
      { label: 'Execution Timeout', value: '2 minutes max per repair' },
      { label: 'Git Push', value: 'Disabled — review before applying' },
      { label: 'CORS Policy', value: 'Vite proxy (localhost only)' },
    ]
  },
];

export default function SettingsPage({ repairData }) {
  const { stats } = repairData;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#8b949e' }}>System configuration, AI provider status, and repair pipeline settings</p>
      </div>

      {/* System health indicator */}
      <div style={{
        padding: '14px 18px', marginBottom: 20, borderRadius: 8,
        background: '#0e2d1e', border: '1px solid #1a4a30',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>All Systems Operational</span>
          <span style={{ fontSize: 12, color: '#8b949e', marginLeft: 12 }}>
            {stats.issuesRepaired} repairs completed · {stats.activeFailures} active failures · {stats.successRate}% success rate
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {CONFIG_SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <div key={section.title} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={15} color="#58a6ff" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{section.title}</span>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                {section.items.map((item, i) => (
                  <div key={i} style={{
                    padding: '10px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: i < section.items.length - 1 ? '1px solid #21262d' : 'none',
                    gap: 12,
                  }}>
                    <span style={{ fontSize: 12, color: '#8b949e', flexShrink: 0 }}>{item.label}</span>
                    <span style={{
                      fontSize: 12,
                      color: item.status === 'active' ? '#34d399'
                        : item.status === 'configured' ? '#22d3ee'
                        : item.status === 'safe' ? '#34d399'
                        : '#c9d1d9',
                      fontFamily: item.mono ? 'JetBrains Mono, monospace' : 'inherit',
                      fontWeight: item.status ? 600 : 400,
                      textAlign: 'right',
                    }}>
                      {item.status === 'active' && <span style={{ marginRight: 4 }}>●</span>}
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={15} color="#58a6ff" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>Project Info</span>
          </div>
        </div>
        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          {[
            { label: 'Project', value: 'RepairAI PS-04' },
            { label: 'Stack', value: 'Node.js · Express · MongoDB' },
            { label: 'Frontend', value: 'React · Vite · Tailwind v4' },
            { label: 'AI SDK', value: '@google/genai' },
            { label: 'Test Framework', value: 'Jest · Supertest' },
            { label: 'Repository', value: 'suryamalla708/hackthon' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 10, color: '#484f58', fontWeight: 600, marginBottom: 3, letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#c9d1d9', fontFamily: 'JetBrains Mono, monospace' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

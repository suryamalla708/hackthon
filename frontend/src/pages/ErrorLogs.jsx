import { useState } from 'react';
import { FileText, Search, Filter, AlertCircle, Clock } from 'lucide-react';

export default function ErrorLogs({ repairData }) {
  const { failures, loading } = repairData;
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Build flat log entries from failures
  const logs = failures.flatMap(f => [
    {
      id: f.failureId,
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      endpoint: f.describeBlock || f.testFile,
      message: f.error?.message?.split('\n')[0] || 'Unknown error',
      stack: f.error?.fullStack || f.error?.message || '',
      file: (f.fileSuspects || [])[0]?.file || '',
      findings: (f.fileSuspects || []).flatMap(s => s.findings || []),
    }
  ]);

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.message.toLowerCase().includes(search.toLowerCase()) ||
      l.endpoint.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>Error Logs</h1>
        <p style={{ fontSize: 13, color: '#8b949e' }}>Captured stack traces and diagnostic information from failing API calls</p>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} color="#484f58" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by endpoint, error message, or failure ID..."
            className="input-field"
            style={{ paddingLeft: 30 }}
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
            padding: '8px 12px', fontSize: 12, color: '#e6edf3', outline: 'none',
          }}
        >
          <option value="all">All Levels</option>
          <option value="ERROR">ERROR</option>
          <option value="WARN">WARN</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#484f58' }}>
          <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: 14 }}>{loading ? 'Loading logs...' : search ? 'No logs match your search.' : 'No error logs found.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((log, i) => {
            const isExpanded = expanded === log.id;
            return (
              <div key={log.id + i} className="card" style={{ border: '1px solid #3d1c1c' }}>
                <div
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: 'auto auto 1fr 1fr auto',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <span className="badge-red">{log.level}</span>
                  <span className="mono badge-slate" style={{ fontSize: 10 }}>{log.id}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3' }}>{log.endpoint}</span>
                  <span style={{ fontSize: 11, color: '#f87171', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.message}
                  </span>
                  <span style={{ fontSize: 10, color: '#484f58' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #21262d', padding: '14px 16px' }} className="slide-in">
                    {/* Findings */}
                    {log.findings.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', marginBottom: 8, letterSpacing: '0.05em' }}>CODE FINDINGS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {log.findings.map((f, fi) => (
                            <div key={fi} style={{
                              background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
                              padding: '8px 12px', fontSize: 11, color: '#8b949e', fontFamily: 'monospace',
                            }}>
                              <span className="badge-amber" style={{ marginRight: 8, fontSize: 9 }}>{f.type}</span>
                              {f.description}
                              {f.line && <span style={{ marginLeft: 8, color: '#484f58' }}>Line {f.line}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stack trace */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', marginBottom: 8, letterSpacing: '0.05em' }}>STACK TRACE</div>
                      <pre style={{
                        background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
                        padding: '12px 14px', fontSize: 11, color: '#8b949e',
                        fontFamily: 'JetBrains Mono, monospace',
                        overflowX: 'auto', whiteSpace: 'pre', maxHeight: 300, overflowY: 'auto',
                        lineHeight: 1.6,
                      }}>
                        {log.stack || 'No stack trace available'}
                      </pre>
                    </div>

                    {/* File suspect */}
                    {log.file && (
                      <div style={{ marginTop: 10, fontSize: 11, color: '#8b949e' }}>
                        <span style={{ color: '#22d3ee' }}>Suspected file: </span>
                        <span className="mono">{log.file}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Code, CheckCircle, XCircle, RefreshCw, Play, Eye } from 'lucide-react';
import axios from 'axios';

export default function CodeFixes({ repairData }) {
  const { failures, history, refetch } = repairData;
  const [selected, setSelected] = useState(null);
  const [runningTest, setRunningTest] = useState(null);
  const [applying, setApplying] = useState(null);

  const items = history.filter(h => h.attempts?.length > 0);
  const item = selected ? items.find(h => h._id === selected) : items[0];

  const triggerRepair = async (failureId) => {
    setApplying(failureId);
    try {
      await axios.post('/api/repairs/run', { failureId });
      refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>Code Fixes</h1>
        <p style={{ fontSize: 13, color: '#8b949e' }}>AI-generated patches with before/after diff view and test verification</p>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#484f58' }}>
          <Code size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>No code fixes available yet. Run a repair to generate patches.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Fix list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(h => (
              <div
                key={h._id}
                onClick={() => setSelected(h._id)}
                className="card"
                style={{
                  padding: '10px 12px', cursor: 'pointer',
                  border: (selected === h._id || (!selected && h === items[0])) ? '1px solid #1f6feb' : '1px solid #30363d',
                  background: (selected === h._id || (!selected && h === items[0])) ? '#1c2128' : '#161b22',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 10, color: '#484f58' }}>{h.failureId}</span>
                  <span className={h.status === 'FIX_VERIFIED' ? 'badge-green' : 'badge-red'} style={{ fontSize: 9 }}>
                    {h.status === 'FIX_VERIFIED' ? '✓' : '✗'} {h.attempts.length} attempt{h.attempts.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.fileSuspects?.[0] || h.testName}
                </div>
                <div style={{ fontSize: 10, color: '#484f58', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.rootCause?.slice(0, 60) || h.errorMsg?.slice(0, 60)}
                </div>
              </div>
            ))}

            {/* Pending failures */}
            <div style={{ borderTop: '1px solid #21262d', paddingTop: 10, marginTop: 6 }}>
              <div style={{ fontSize: 10, color: '#484f58', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>PENDING REPAIRS</div>
              {failures.filter(f => !history.find(h => h.failureId === f.failureId)).slice(0, 5).map(f => (
                <div key={f.failureId} className="card" style={{ padding: '8px 10px', marginBottom: 6, border: '1px solid #30363d' }}>
                  <div style={{ fontSize: 10, color: '#fbbf24', marginBottom: 4 }}>{f.failureId}</div>
                  <div style={{ fontSize: 10, color: '#484f58', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                    {f.testName}
                  </div>
                  <button
                    onClick={() => triggerRepair(f.failureId)}
                    disabled={applying === f.failureId}
                    className="btn-primary"
                    style={{ fontSize: 10, padding: '4px 8px', width: '100%', justifyContent: 'center' }}
                  >
                    {applying === f.failureId ? <><RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />Running...</> : <><Play size={10} />Run Repair</>}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Diff Viewer */}
          {item && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="slide-in">
              {/* Header */}
              <div className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Code size={15} color="#58a6ff" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>Patch Diff View</span>
                    <span className="mono badge-slate" style={{ fontSize: 10 }}>{item.failureId}</span>
                  </div>
                  <span className={item.status === 'FIX_VERIFIED' ? 'badge-green' : 'badge-red'}>{item.status}</span>
                </div>
                <div style={{ padding: '10px 16px', fontSize: 12, color: '#8b949e', background: '#0d1117', borderRadius: '0 0 6px 6px' }}>
                  <span style={{ color: '#22d3ee' }}>Root cause: </span>{item.rootCause}
                </div>
              </div>

              {/* All attempts */}
              {item.attempts.map((attempt, idx) => {
                const passed = attempt.testOutput?.includes('passed') || attempt.testOutput?.includes('1 passed');
                return (
                  <div key={idx} className="card">
                    <div className="card-header" style={{ background: '#0d1117' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#8b949e' }}>
                          Attempt {attempt.attemptNumber} of {item.attempts.length}
                        </span>
                        {idx === item.attempts.length - 1 && (
                          <span style={{ fontSize: 10, color: '#484f58' }}>(final)</span>
                        )}
                      </div>
                      <span className={passed ? 'badge-green' : 'badge-red'} style={{ fontSize: 9 }}>
                        {passed ? 'TESTS PASSED' : 'TESTS FAILED'}
                      </span>
                    </div>

                    {/* Diff */}
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6 }}>
                      {/* Before (search) */}
                      <div style={{ background: '#3d1c1c1a', borderBottom: '1px solid #21262d' }}>
                        <div style={{ padding: '4px 14px', fontSize: 10, color: '#8b949e', borderBottom: '1px solid #21262d', background: '#3d1c1c3a' }}>
                          — BEFORE (original code)
                        </div>
                        <pre style={{ padding: '12px 14px', margin: 0, color: '#f87171', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          <span style={{ color: '#5c2626', userSelect: 'none', marginRight: 8 }}>-</span>
                          {attempt.search}
                        </pre>
                      </div>

                      {/* After (replace) */}
                      <div style={{ background: '#0e2d1e1a' }}>
                        <div style={{ padding: '4px 14px', fontSize: 10, color: '#8b949e', borderBottom: '1px solid #21262d', background: '#0e2d1e3a' }}>
                          + AFTER (AI-generated fix)
                        </div>
                        <pre style={{ padding: '12px 14px', margin: 0, color: '#34d399', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          <span style={{ color: '#1a4a30', userSelect: 'none', marginRight: 8 }}>+</span>
                          {attempt.replace}
                        </pre>
                      </div>
                    </div>

                    {/* Test output */}
                    <div style={{ padding: '10px 14px', borderTop: '1px solid #21262d' }}>
                      <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>TEST OUTPUT</div>
                      <pre style={{
                        background: '#0d1117', border: `1px solid ${passed ? '#1a4a30' : '#3d1c1c'}`,
                        borderRadius: 4, padding: '8px 12px', fontSize: 11, color: passed ? '#34d399' : '#f87171',
                        fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto',
                      }}>
                        {attempt.testOutput?.split('\n').filter(l => l.includes('Tests:') || l.includes('PASS') || l.includes('FAIL') || l.includes('✓') || l.includes('✗')).join('\n') || attempt.testOutput?.slice(0, 300)}
                      </pre>
                    </div>
                  </div>
                );
              })}

              {/* Final verdict */}
              <div style={{
                padding: '14px 18px',
                borderRadius: 6,
                background: item.status === 'FIX_VERIFIED' ? '#0e2d1e' : '#3d1c1c',
                border: `1px solid ${item.status === 'FIX_VERIFIED' ? '#1a4a30' : '#5c2626'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 14,
                fontWeight: 700,
                color: item.status === 'FIX_VERIFIED' ? '#34d399' : '#f87171',
              }}>
                {item.status === 'FIX_VERIFIED'
                  ? <><CheckCircle size={18} /> FIX VERIFIED — Patch applied and all tests passed</>
                  : <><XCircle size={18} /> REPAIR FAILED — All {item.attempts.length} attempts exhausted</>
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

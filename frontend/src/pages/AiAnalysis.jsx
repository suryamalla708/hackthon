import { useState } from 'react';
import { Cpu, FileText, Search, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';

export default function AiAnalysis({ repairData, onNavigate }) {
  const { failures, history, loading } = repairData;
  const [selected, setSelected] = useState(null);

  // Build analysis entries from history (has AI output) + failures
  const analysisItems = history.map(h => ({
    id: h._id,
    failureId: h.failureId,
    testName: h.testName,
    errorMsg: h.errorMsg,
    rootCause: h.rootCause,
    explanation: h.explanation,
    fileSuspects: h.fileSuspects || [],
    attempts: h.attempts || [],
    status: h.status,
    createdAt: h.createdAt,
    // Evidence from the attempt
    evidence: h.attempts?.[0]?.search || null,
  }));

  // Also include pending failures with no history entry
  const pendingFailures = failures.filter(f => !history.find(h => h.failureId === f.failureId));

  const item = selected ? analysisItems.find(a => a.id === selected) : analysisItems[0];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>AI Analysis</h1>
        <p style={{ fontSize: 13, color: '#8b949e' }}>Root cause analysis and AI investigation results from completed repair sessions</p>
      </div>

      {analysisItems.length === 0 && pendingFailures.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#484f58' }}>
          <Cpu size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>No analysis data available. Run a repair to generate AI analysis.</p>
          <button onClick={() => onNavigate('dashboard')} className="btn-primary" style={{ marginTop: 14 }}>
            Go to Dashboard →
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* List panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingFailures.map(f => (
              <div key={f.failureId} className="card" style={{ padding: '10px 12px', border: '1px solid #30363d', cursor: 'default' }}>
                <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="badge-amber" style={{ fontSize: 9 }}>PENDING</span>
                  <span className="mono" style={{ fontSize: 10, color: '#484f58' }}>{f.failureId}</span>
                </div>
                <div style={{ fontSize: 11, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.testName}
                </div>
                <div style={{ fontSize: 10, color: '#484f58', marginTop: 4 }}>No AI analysis yet</div>
              </div>
            ))}
            {analysisItems.map(a => (
              <div
                key={a.id}
                onClick={() => setSelected(a.id)}
                className="card"
                style={{
                  padding: '10px 12px',
                  border: (selected === a.id || (!selected && a === analysisItems[0])) ? '1px solid #1f6feb' : '1px solid #30363d',
                  cursor: 'pointer',
                  background: (selected === a.id || (!selected && a === analysisItems[0])) ? '#1c2128' : '#161b22',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span className={a.status === 'FIX_VERIFIED' ? 'badge-green' : 'badge-red'} style={{ fontSize: 9 }}>
                    {a.status}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: '#484f58' }}>{a.failureId}</span>
                </div>
                <div style={{ fontSize: 11, color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.testName}
                </div>
                <div style={{ fontSize: 10, color: '#484f58', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.rootCause || 'No root cause recorded'}
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {item && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="slide-in">
              {/* Header */}
              <div className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono badge-slate" style={{ fontSize: 10 }}>{item.failureId}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{item.testName}</span>
                  </div>
                  <span className={item.status === 'FIX_VERIFIED' ? 'badge-green' : 'badge-red'}>{item.status}</span>
                </div>
                <div style={{ padding: '12px 16px', fontSize: 12, color: '#8b949e', fontFamily: 'monospace', background: '#0d1117', borderRadius: '0 0 6px 6px' }}>
                  {item.errorMsg}
                </div>
              </div>

              {/* Root Cause + Explanation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="card">
                  <div className="card-header">
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', letterSpacing: '0.05em' }}>ROOT CAUSE</span>
                  </div>
                  <div style={{ padding: '12px 16px', fontSize: 13, color: '#e6edf3', lineHeight: 1.6 }}>
                    {item.rootCause || <span style={{ color: '#484f58' }}>Not determined</span>}
                  </div>
                </div>
                <div className="card">
                  <div className="card-header">
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', letterSpacing: '0.05em' }}>AI EXPLANATION</span>
                  </div>
                  <div style={{ padding: '12px 16px', fontSize: 13, color: '#c9d1d9', lineHeight: 1.6 }}>
                    {item.explanation || <span style={{ color: '#484f58' }}>No explanation generated</span>}
                  </div>
                </div>
              </div>

              {/* Evidence / Affected files */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="card">
                  <div className="card-header">
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', letterSpacing: '0.05em' }}>AFFECTED FILES</span>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    {item.fileSuspects.length > 0
                      ? item.fileSuspects.map((f, i) => (
                        <div key={i} style={{
                          padding: '6px 10px', background: '#0d1117', borderRadius: 4,
                          fontSize: 12, fontFamily: 'monospace', color: '#22d3ee',
                          marginBottom: 6, border: '1px solid #30363d',
                        }}>
                          {f}
                        </div>
                      ))
                      : <span style={{ color: '#484f58', fontSize: 12 }}>No file information</span>
                    }
                  </div>
                </div>
                <div className="card">
                  <div className="card-header">
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', letterSpacing: '0.05em' }}>ERROR EVIDENCE</span>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    {item.evidence
                      ? <pre style={{ fontSize: 11, fontFamily: 'monospace', color: '#f87171', background: '#0d1117', padding: '8px 10px', borderRadius: 4, border: '1px solid #3d1c1c', whiteSpace: 'pre-wrap', overflow: 'auto' }}>{item.evidence}</pre>
                      : <span style={{ color: '#484f58', fontSize: 12 }}>No evidence captured</span>
                    }
                  </div>
                </div>
              </div>

              {/* Agent Actions */}
              <div className="card">
                <div className="card-header">
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', letterSpacing: '0.05em' }}>AGENT ACTIONS ({item.attempts.length} attempt{item.attempts.length !== 1 ? 's' : ''})</span>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {item.attempts.length === 0
                    ? <span style={{ color: '#484f58', fontSize: 12 }}>No attempts recorded</span>
                    : item.attempts.map((a, i) => (
                      <div key={i} style={{
                        marginBottom: 10,
                        padding: '10px 12px',
                        background: '#0d1117',
                        border: `1px solid ${a.testOutput?.includes('passed') ? '#1a4a30' : '#3d1c1c'}`,
                        borderRadius: 6,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
                          <span style={{ color: '#8b949e', fontWeight: 600 }}>Attempt {a.attemptNumber}</span>
                          <span className={a.testOutput?.includes('passed') ? 'badge-green' : 'badge-red'} style={{ fontSize: 9 }}>
                            {a.testOutput?.includes('passed') ? 'TESTS PASSED' : 'TESTS FAILED'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>
                          {a.testOutput?.split('\n').find(l => l.includes('Tests:')) || a.testOutput?.slice(0, 120)}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { CheckCircle, XCircle, Activity } from 'lucide-react';

function parseTestOutput(output) {
  if (!output) return null;
  const testLine = output.split('\n').find(l => l.includes('Tests:'));
  if (!testLine) return null;

  const passed = testLine.match(/(\d+) passed/)?.[1];
  const failed = testLine.match(/(\d+) failed/)?.[1];
  const skipped = testLine.match(/(\d+) skipped/)?.[1];
  const total = testLine.match(/(\d+) total/)?.[1];
  const timeLine = output.split('\n').find(l => l.includes('Time:'));
  const time = timeLine?.match(/([\d.]+) s/)?.[1];

  return {
    passed: parseInt(passed) || 0,
    failed: parseInt(failed) || 0,
    skipped: parseInt(skipped) || 0,
    total: parseInt(total) || 0,
    time: time ? parseFloat(time) : null,
    raw: testLine,
  };
}

export default function TestResults({ repairData }) {
  const { history } = repairData;
  const [selected, setSelected] = useState(null);

  // Build test result items from history attempts
  const allResults = history.flatMap(h =>
    (h.attempts || []).map(a => ({
      historyId: h._id,
      failureId: h.failureId,
      testName: h.testName,
      attemptNumber: a.attemptNumber,
      testOutput: a.testOutput,
      historyStatus: h.status,
      parsed: parseTestOutput(a.testOutput),
    }))
  );

  const item = selected
    ? allResults.find(r => r.historyId + r.attemptNumber === selected)
    : allResults[allResults.length - 1]; // default: latest

  const totalPassed = allResults.reduce((s, r) => s + (r.parsed?.passed || 0), 0);
  const totalFailed = allResults.reduce((s, r) => s + (r.parsed?.failed || 0), 0);
  const verifiedCount = history.filter(h => h.status === 'FIX_VERIFIED').length;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>Test Results</h1>
        <p style={{ fontSize: 13, color: '#8b949e' }}>Jest/Supertest verification results from all AI repair attempts</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'FIX VERIFIED', value: verifiedCount, color: '#34d399', bg: '#0e2d1e', border: '#1a4a30' },
          { label: 'Total Passes', value: totalPassed, color: '#34d399', bg: '#0e2d1e', border: '#1a4a30' },
          { label: 'Total Failures', value: totalFailed, color: '#f87171', bg: '#3d1c1c', border: '#5c2626' },
          { label: 'Total Attempts', value: allResults.length, color: '#58a6ff', bg: '#0e1e3a', border: '#1a3060' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: '14px 18px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {allResults.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#484f58' }}>
          <Activity size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>No test results available. Run a repair to generate test output.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
          {/* Test run list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: '#484f58', fontWeight: 600, letterSpacing: '0.05em', padding: '0 2px', marginBottom: 4 }}>
              TEST RUNS ({allResults.length})
            </div>
            {allResults.map(r => {
              const key = r.historyId + r.attemptNumber;
              const isSelected = (selected === key) || (!selected && r === allResults[allResults.length - 1]);
              const passed = r.parsed?.passed > 0 && r.parsed?.failed === 0;

              return (
                <div
                  key={key}
                  onClick={() => setSelected(key)}
                  className="card"
                  style={{
                    padding: '9px 12px', cursor: 'pointer',
                    border: isSelected ? '1px solid #1f6feb' : '1px solid #30363d',
                    background: isSelected ? '#1c2128' : '#161b22',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 10, color: '#484f58' }}>
                      {r.failureId} · Attempt {r.attemptNumber}
                    </span>
                    {passed
                      ? <CheckCircle size={12} color="#22c55e" />
                      : <XCircle size={12} color="#ef4444" />
                    }
                  </div>
                  {r.parsed && (
                    <div style={{ fontSize: 11, color: '#8b949e' }}>
                      <span style={{ color: '#34d399' }}>{r.parsed.passed} passed</span>
                      {r.parsed.failed > 0 && <span style={{ color: '#f87171', marginLeft: 6 }}>{r.parsed.failed} failed</span>}
                      {r.parsed.skipped > 0 && <span style={{ color: '#fbbf24', marginLeft: 6 }}>{r.parsed.skipped} skipped</span>}
                      {r.parsed.time && <span style={{ color: '#484f58', marginLeft: 6 }}>{r.parsed.time}s</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {item && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="slide-in">
              {/* Header */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>
                      {item.failureId} — Attempt {item.attemptNumber}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{item.testName}</div>
                  </div>
                  {item.parsed
                    ? (item.parsed.failed === 0 && item.parsed.passed > 0
                      ? <span className="badge-green">✓ PASSED</span>
                      : <span className="badge-red">✗ FAILED</span>)
                    : null
                  }
                </div>

                {/* Parsed stats */}
                {item.parsed && (
                  <div style={{ padding: '14px 16px', display: 'flex', gap: 20, borderBottom: '1px solid #21262d' }}>
                    {[
                      { label: 'Passed', value: item.parsed.passed, color: '#34d399' },
                      { label: 'Failed', value: item.parsed.failed, color: '#f87171' },
                      { label: 'Skipped', value: item.parsed.skipped, color: '#fbbf24' },
                      { label: 'Total', value: item.parsed.total, color: '#8b949e' },
                      { label: 'Duration', value: item.parsed.time ? `${item.parsed.time}s` : '—', color: '#58a6ff' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: '#484f58', fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Raw output */}
              <div className="card">
                <div className="card-header">
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', letterSpacing: '0.05em' }}>JEST OUTPUT</span>
                </div>
                <pre style={{
                  padding: '14px 16px', margin: 0,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#c9d1d9',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 400,
                  overflowY: 'auto',
                }}>
                  {item.testOutput || 'No output captured'}
                </pre>
              </div>

              {/* Verdict */}
              {item.historyStatus === 'FIX_VERIFIED' && item.parsed?.failed === 0 && (
                <div style={{
                  padding: '16px 20px', borderRadius: 6,
                  background: '#0e2d1e', border: '1px solid #1a4a30',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 15, fontWeight: 700, color: '#34d399',
                }}>
                  <CheckCircle size={20} />
                  FIX VERIFIED — All tests passed successfully
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

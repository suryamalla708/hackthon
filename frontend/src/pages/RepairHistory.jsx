import { Clock, ChevronRight, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function RepairHistory({ repairData, onNavigate }) {
  const { history, loading, refetch } = repairData;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>Repair History</h1>
          <p style={{ fontSize: 13, color: '#8b949e' }}>All previous AI repair sessions stored in MongoDB</p>
        </div>
        <button onClick={refetch} className="btn-secondary" disabled={loading}>
          <RefreshCw size={13} />Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Sessions', value: history.length, color: '#58a6ff' },
          { label: 'FIX VERIFIED', value: history.filter(h => h.status === 'FIX_VERIFIED').length, color: '#34d399' },
          { label: 'REPAIR FAILED', value: history.filter(h => h.status === 'REPAIR_FAILED').length, color: '#f87171' },
          { label: 'Avg Attempts', value: history.length > 0 ? (history.reduce((s, h) => s + (h.attempts?.length || 0), 0) / history.length).toFixed(1) : '—', color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {history.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#484f58' }}>
          <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: 14 }}>{loading ? 'Loading history...' : 'No repair history found. Run a repair to create records.'}</p>
          {!loading && (
            <button onClick={() => onNavigate('dashboard')} className="btn-primary" style={{ marginTop: 14 }}>
              Go to Dashboard →
            </button>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Failure ID</th>
                  <th>Test / Endpoint</th>
                  <th>Root Cause</th>
                  <th>Affected Files</th>
                  <th>Attempts</th>
                  <th>Timestamp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h._id}>
                    <td>
                      {h.status === 'FIX_VERIFIED'
                        ? <span className="badge-green"><CheckCircle size={10} /> FIX VERIFIED</span>
                        : <span className="badge-red"><XCircle size={10} /> REPAIR FAILED</span>
                      }
                    </td>
                    <td><span className="mono badge-slate" style={{ fontSize: 10 }}>{h.failureId}</span></td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ fontSize: 12, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.testName}
                      </div>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      <span style={{ fontSize: 11, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {h.rootCause || '—'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(h.fileSuspects || []).slice(0, 2).map((f, i) => (
                          <span key={i} className="mono" style={{ fontSize: 10, color: '#22d3ee' }}>{f}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{h.attempts?.length || 0}</span>
                      <span style={{ fontSize: 10, color: '#484f58' }}>/3</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: '#484f58', fontFamily: 'monospace' }}>
                        {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => onNavigate('code-fixes')} className="btn-secondary" style={{ fontSize: 10, padding: '4px 8px' }}>
                        View <ChevronRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle, AlertCircle, Clock, Shield } from 'lucide-react';
import axios from 'axios';

const ENDPOINTS = [
  { method: 'POST',   path: '/api/products',    category: 'Products' },
  { method: 'GET',    path: '/api/products',    category: 'Products' },
  { method: 'GET',    path: '/api/products/:id',category: 'Products' },
  { method: 'POST',   path: '/api/users',       category: 'Users'    },
  { method: 'GET',    path: '/api/users',       category: 'Users'    },
  { method: 'DELETE', path: '/api/users/:id',   category: 'Users'    },
];

function methodBadge(method) {
  const map = { GET: 'badge-cyan', POST: 'badge-amber', DELETE: 'badge-red', PUT: 'badge-slate', PATCH: 'badge-slate' };
  return <span className={`${map[method] || 'badge-slate'} mono`} style={{ fontSize: 10 }}>{method}</span>;
}

export default function ApiMonitor({ repairData }) {
  const { failures, apiHealth, loading, refetch } = repairData;
  const [pingResults, setPingResults] = useState({});
  const [pinging, setPinging] = useState(false);

  const pingAll = async () => {
    setPinging(true);
    const results = {};
    await Promise.all(ENDPOINTS.map(async ep => {
      const start = Date.now();
      try {
        const method = ep.method.toLowerCase();
        let res;
        if (method === 'get') {
          const url = ep.path.replace('/:id', '/000000000000000000000000');
          res = await axios.get(url);
        } else if (method === 'delete') {
          res = await axios({ method: 'delete', url: ep.path.replace('/:id', '/000000000000000000000000') });
        } else {
          res = await axios.post(ep.path, {});
        }
        results[ep.path + ep.method] = { status: res.status, ms: Date.now() - start, ok: true };
      } catch (err) {
        results[ep.path + ep.method] = {
          status: err.response?.status || 0,
          ms: Date.now() - start,
          ok: err.response?.status === 200 || err.response?.status === 201,
          error: err.response?.data?.error || err.message
        };
      }
    }));
    setPingResults(results);
    setPinging(false);
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>API Monitor</h1>
          <p style={{ fontSize: 13, color: '#8b949e' }}>Real-time health monitoring for all tracked API endpoints</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refetch} className="btn-secondary" disabled={loading}>
            <RefreshCw size={13} />Refresh
          </button>
          <button onClick={pingAll} className="btn-primary" disabled={pinging}>
            <Activity size={13} />{pinging ? 'Pinging...' : 'Ping All Endpoints'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Endpoints', value: ENDPOINTS.length, color: '#58a6ff' },
          { label: 'Failing', value: apiHealth.filter(e => e.status === 'failing').length, color: '#f87171' },
          { label: 'Healthy', value: apiHealth.filter(e => e.status === 'healthy').length, color: '#34d399' },
          { label: 'Active Failures', value: failures.length, color: '#fbbf24' },
        ].map(c => (
          <div key={c.label} className="card" style={{ flex: 1, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, fontWeight: 500 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Main endpoint table */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={15} color="#58a6ff" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>Endpoint Health</span>
          </div>
          {Object.keys(pingResults).length > 0 && (
            <span className="badge-cyan">Live ping results</span>
          )}
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Category</th>
                <th>Health</th>
                <th>Response (ms)</th>
                <th>HTTP Status</th>
                <th>Last Error</th>
                <th>AI Status</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map(ep => {
                const health = apiHealth.find(h => h.path === ep.path && h.method === ep.method);
                const ping = pingResults[ep.path + ep.method];
                const isFailing = health?.status === 'failing';
                return (
                  <tr key={ep.path + ep.method}>
                    <td>{methodBadge(ep.method)}</td>
                    <td><span className="mono" style={{ fontSize: 12 }}>{ep.path}</span></td>
                    <td><span style={{ fontSize: 11, color: '#8b949e' }}>{ep.category}</span></td>
                    <td>
                      {isFailing
                        ? <span className="badge-red">● Failing</span>
                        : <span className="badge-green">● Healthy</span>
                      }
                    </td>
                    <td>
                      {ping
                        ? <span className="mono" style={{ fontSize: 12, color: ping.ms > 500 ? '#fbbf24' : '#34d399' }}>{ping.ms}ms</span>
                        : <span style={{ color: '#484f58', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td>
                      {ping
                        ? <span className={`mono badge-${ping.status >= 400 ? 'red' : ping.status >= 300 ? 'amber' : 'green'}`} style={{ fontSize: 10 }}>{ping.status}</span>
                        : <span style={{ color: '#484f58', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <span style={{ fontSize: 11, color: '#8b949e', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {health?.errorMsg || ping?.error || '—'}
                      </span>
                    </td>
                    <td>
                      {health?.aiStatus === 'FIX_VERIFIED' && <span className="badge-green">FIX VERIFIED</span>}
                      {health?.aiStatus === 'PENDING' && <span className="badge-amber">PENDING</span>}
                      {health?.aiStatus === 'OK' && <span className="badge-slate">OK</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active failures detail */}
      {failures.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={15} color="#f87171" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>Active Failure Detail</span>
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {failures.slice(0, 5).map(f => (
              <div key={f.failureId} style={{
                background: '#0d1117', border: '1px solid #3d1c1c',
                borderRadius: 6, padding: '10px 14px',
                display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: 14, alignItems: 'start'
              }}>
                <span className="badge-red mono" style={{ fontSize: 10 }}>{f.failureId}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', marginBottom: 3 }}>{f.describeBlock || f.testFile}</div>
                  <div style={{ fontSize: 11, color: '#8b949e' }}>{f.testName}</div>
                </div>
                <div style={{ fontSize: 11, color: '#f87171', fontFamily: 'monospace' }}>
                  {f.error?.message?.split('\n')[0]}
                </div>
                <span className="badge-amber">Investigating</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

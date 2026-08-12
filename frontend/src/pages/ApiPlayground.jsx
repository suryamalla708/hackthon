import { useState } from 'react';
import { Terminal, Send, ChevronDown } from 'lucide-react';
import axios from 'axios';

const ENDPOINTS = [
  { method: 'GET',    path: '/api/products',                  body: null },
  { method: 'POST',   path: '/api/products',                  body: { name: 'Test Product', price: 29.99, category: 'test' } },
  { method: 'GET',    path: '/api/products/:id',               body: null, paramName: 'id' },
  { method: 'GET',    path: '/api/users',                     body: null },
  { method: 'POST',   path: '/api/users',                     body: { name: 'Test User', email: 'test@test.com' } },
  { method: 'DELETE', path: '/api/users/:id',                 body: null, paramName: 'id' },
];

const METHOD_COLORS = { GET: '#22d3ee', POST: '#fbbf24', DELETE: '#f87171', PUT: '#a78bfa', PATCH: '#34d399' };

export default function ApiPlayground() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [bodyText, setBodyText] = useState(JSON.stringify(ENDPOINTS[0].body, null, 2) || '');
  const [pathParam, setPathParam] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reqTime, setReqTime] = useState(null);

  const selectEndpoint = (ep) => {
    setSelectedEndpoint(ep);
    setBodyText(ep.body ? JSON.stringify(ep.body, null, 2) : '');
    setResponse(null);
    setPathParam('');
  };

  const send = async () => {
    setLoading(true);
    setResponse(null);
    const start = Date.now();
    try {
      let url = selectedEndpoint.path;
      if (selectedEndpoint.paramName && pathParam) {
        url = url.replace(`:${selectedEndpoint.paramName}`, pathParam);
      }

      let res;
      const method = selectedEndpoint.method.toLowerCase();
      const body = bodyText ? JSON.parse(bodyText) : undefined;

      if (method === 'get') res = await axios.get(url);
      else if (method === 'post') res = await axios.post(url, body);
      else if (method === 'delete') res = await axios.delete(url);
      else if (method === 'put') res = await axios.put(url, body);
      else if (method === 'patch') res = await axios.patch(url, body);

      setReqTime(Date.now() - start);
      setResponse({ status: res.status, data: res.data, headers: res.headers, ok: true });
    } catch (err) {
      setReqTime(Date.now() - start);
      setResponse({
        status: err.response?.status || 0,
        data: err.response?.data || { error: err.message },
        headers: err.response?.headers || {},
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>API Playground</h1>
        <p style={{ fontSize: 13, color: '#8b949e' }}>Send requests to backend endpoints and inspect live responses</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Request panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>Request</span>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Endpoint selector */}
              <div>
                <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>ENDPOINT</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ENDPOINTS.map(ep => (
                    <button
                      key={ep.method + ep.path}
                      onClick={() => selectEndpoint(ep)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        background: selectedEndpoint === ep ? '#1c2128' : 'transparent',
                        border: selectedEndpoint === ep ? '1px solid #1f6feb' : '1px solid #30363d',
                        borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{
                        minWidth: 52, fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                        color: METHOD_COLORS[ep.method] || '#8b949e',
                      }}>
                        {ep.method}
                      </span>
                      <span className="mono" style={{ fontSize: 12, color: '#c9d1d9' }}>{ep.path}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Path param */}
              {selectedEndpoint.paramName && (
                <div>
                  <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>
                    PATH PARAMETER: :{selectedEndpoint.paramName}
                  </div>
                  <input
                    value={pathParam}
                    onChange={e => setPathParam(e.target.value)}
                    placeholder="Enter ID..."
                    className="input-field mono"
                    style={{ fontSize: 12 }}
                  />
                </div>
              )}

              {/* Body */}
              {selectedEndpoint.body !== null && (
                <div>
                  <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>REQUEST BODY (JSON)</div>
                  <textarea
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    rows={8}
                    style={{
                      width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
                      padding: '10px 12px', fontSize: 12, color: '#e6edf3', outline: 'none',
                      fontFamily: 'JetBrains Mono, monospace', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <button onClick={send} disabled={loading} className="btn-primary" style={{ justifyContent: 'center' }}>
                <Send size={13} />
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>

        {/* Response panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>Response</span>
            {response && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={response.ok ? 'badge-green' : 'badge-red'} style={{ fontSize: 11 }}>
                  {response.status}
                </span>
                {reqTime !== null && (
                  <span style={{ fontSize: 11, color: '#484f58' }}>{reqTime}ms</span>
                )}
              </div>
            )}
          </div>

          {!response ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', padding: 48, flexDirection: 'column', gap: 10 }}>
              <Terminal size={36} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>Send a request to see the response</p>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Headers */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #21262d' }}>
                <div style={{ fontSize: 10, color: '#484f58', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>RESPONSE HEADERS</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8b949e', maxHeight: 80, overflowY: 'auto' }}>
                  {Object.entries(response.headers || {}).slice(0, 6).map(([k, v]) => (
                    <div key={k}><span style={{ color: '#22d3ee' }}>{k}</span>: {v}</div>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '10px 14px', flex: 1 }}>
                <div style={{ fontSize: 10, color: '#484f58', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>RESPONSE BODY</div>
                <pre style={{
                  background: '#0d1117', border: `1px solid ${response.ok ? '#1a4a30' : '#3d1c1c'}`,
                  borderRadius: 6, padding: '12px 14px', margin: 0,
                  fontSize: 12, color: response.ok ? '#34d399' : '#f87171',
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: 380, overflowY: 'auto',
                }}>
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

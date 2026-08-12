import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  AlertCircle, Search, FileText, Cpu, Code, CheckCircle, Activity,
  RefreshCw, Play, Send, ChevronRight, Bot, Zap, Shield, Clock,
  XCircle, RotateCcw, Database, Loader,
} from 'lucide-react';

const PIPELINE = [
  { id: 'detect',    label: 'Detect Failure',     color: '#ef4444', icon: AlertCircle },
  { id: 'analyze',   label: 'Analyze Error',       color: '#f97316', icon: Search },
  { id: 'logs',      label: 'Inspect Logs',        color: '#eab308', icon: FileText },
  { id: 'rootcause', label: 'Root Cause',          color: '#a855f7', icon: Cpu },
  { id: 'locate',    label: 'Locate Code',         color: '#3b82f6', icon: Code },
  { id: 'generate',  label: 'Generate Fix',        color: '#22d3ee', icon: Zap },
  { id: 'test',      label: 'Run Tests',           color: '#10b981', icon: Activity },
  { id: 'verify',    label: 'Verify',              color: '#22c55e', icon: CheckCircle },
];

const STEP_DELAY = 1800; // ms per step during animation

function PipelineBar({ activeStep, result }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '4px 0' }} className="scrollbar-none">
      {PIPELINE.map((step, i) => {
        const Icon = step.icon;
        const isDone = activeStep > i || (result && result.status === 'FIX_VERIFIED');
        const isActive = activeStep === i;
        const isFailed = result && result.status === 'REPAIR_FAILED' && activeStep === i;

        let bg = '#161b22';
        let border = '#30363d';
        let textColor = '#484f58';
        let iconColor = '#484f58';

        if (isDone) { bg = '#0e2d1e'; border = '#1a4a30'; textColor = '#34d399'; iconColor = '#34d399'; }
        if (isActive) { bg = '#0e2433'; border = step.color; textColor = '#e6edf3'; iconColor = step.color; }
        if (isFailed) { bg = '#3d1c1c'; border = '#ef4444'; textColor = '#f87171'; iconColor = '#f87171'; }

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                minWidth: 100, padding: '10px 12px',
                background: bg, border: `1px solid ${border}`, borderRadius: 6,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                transition: 'all 0.4s',
                ...(isActive ? { boxShadow: `0 0 12px ${step.color}44` } : {}),
              }}
              className={isActive ? 'step-pulsing' : ''}
            >
              {isDone && !isActive
                ? <CheckCircle size={16} color="#34d399" />
                : <Icon size={16} color={iconColor} />
              }
              <span style={{ fontSize: 10, fontWeight: 600, color: textColor, textAlign: 'center', lineHeight: 1.3, letterSpacing: '0.02em' }}>
                {step.label.toUpperCase()}
              </span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div style={{
                width: 20, height: 1,
                background: isDone ? '#1a4a30' : '#21262d',
                transition: 'background 0.4s',
                flexShrink: 0,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: '16px 20px', flex: 1 }}>
      <div style={{ fontSize: 12, color: '#8b949e', fontWeight: 500, marginBottom: 8, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || '#e6edf3', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#484f58', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function AgentActivityFeed({ history, repairingId, activeStep, terminalLogs }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [terminalLogs]);

  const recentHistory = history.slice(0, 5);

  return (
    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 220, maxHeight: 340 }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={15} color="#58a6ff" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>AI Agent Activity</span>
        </div>
        {repairingId && (
          <span className="badge-cyan" style={{ animation: 'pulse 1s infinite' }}>LIVE</span>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} className="mono">
        {terminalLogs.length > 0 ? terminalLogs.map((log, i) => (
          <div key={i} style={{
            padding: '5px 14px',
            display: 'flex',
            gap: 8,
            fontSize: 11,
            borderBottom: i < terminalLogs.length - 1 ? '1px solid #0d1117' : 'none',
          }}>
            <span style={{ color: '#484f58', flexShrink: 0 }}>{log.time}</span>
            <span style={{
              color: log.type === 'error' ? '#f87171' : log.type === 'green' ? '#34d399' : log.type === 'cyan' ? '#22d3ee' : '#8b949e'
            }}>{log.text}</span>
          </div>
        )) : recentHistory.map((h, i) => (
          <div key={h._id || i} style={{
            padding: '7px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            borderBottom: i < recentHistory.length - 1 ? '1px solid #0d1117' : 'none',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: h.status === 'FIX_VERIFIED' ? '#22c55e' : '#ef4444',
            }} />
            <span style={{ color: '#8b949e' }}>
              {h.status === 'FIX_VERIFIED' ? '✓ Repair verified: ' : '✗ Repair failed: '}
            </span>
            <span style={{ color: '#e6edf3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {h.failureId} — {h.rootCause?.slice(0, 60) || h.errorMsg?.slice(0, 60)}
            </span>
          </div>
        ))}
        {terminalLogs.length === 0 && recentHistory.length === 0 && (
          <div style={{ padding: '20px 14px', color: '#484f58', fontSize: 12 }}>
            No agent activity yet. Run a repair to see live logs.
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function AiChat({ failures, history }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I can answer questions about your API failures and repair history. Try asking me something below.' }
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const QUICK = [
    'Why is this API failing?',
    'What file is causing the error?',
    'What fix was generated?',
    'Why did the repair fail?',
  ];

  const answer = (q) => {
    const lower = q.toLowerCase();
    let resp = '';

    if (lower.includes('why') && lower.includes('failing')) {
      if (failures.length === 0) {
        resp = 'No active failures detected. All monitored APIs appear healthy.';
      } else {
        const f = failures[0];
        resp = `The top active failure is on ${f.describeBlock || f.testFile}.\n\nError: ${f.error?.message?.split('\n')[0]}\n\nSuspect files: ${(f.fileSuspects || []).map(s => s.file).join(', ')}.`;
      }
    } else if (lower.includes('file') && (lower.includes('causing') || lower.includes('error'))) {
      const suspects = failures.flatMap(f => (f.fileSuspects || []).map(s => s.file));
      const unique = [...new Set(suspects)];
      resp = unique.length > 0
        ? `The following files are suspected:\n${unique.map(f => `• ${f}`).join('\n')}`
        : 'No suspect files identified yet. Run the pipeline to perform code search.';
    } else if (lower.includes('fix') && lower.includes('generated')) {
      const latest = history.find(h => h.attempts?.length > 0);
      if (latest) {
        const a = latest.attempts[latest.attempts.length - 1];
        resp = `Latest repair for ${latest.failureId}:\n\nSearch:\n  ${a.search}\n\nReplace:\n  ${a.replace}\n\nStatus: ${latest.status}`;
      } else {
        resp = 'No repairs have been run yet. Select a failure and click "Run AI Repair" to generate a fix.';
      }
    } else if (lower.includes('why') && lower.includes('repair') && lower.includes('fail')) {
      const failed = history.filter(h => h.status === 'REPAIR_FAILED');
      if (failed.length > 0) {
        resp = `${failed.length} repair(s) failed.\n\nLatest: ${failed[0].failureId}\nRoot cause: ${failed[0].rootCause || 'Unknown'}\n\nThis usually happens when the AI-generated patch doesn't pass the Jest/Supertest tests after ${failed[0].attempts?.length || 0} attempts.`;
      } else {
        resp = 'No failed repairs found in the history. All completed repairs were verified successfully.';
      }
    } else {
      resp = `I found ${failures.length} active failure(s) and ${history.length} repair record(s). Try asking me about a specific failure, file, or generated fix.`;
    }
    return resp;
  };

  const send = (text) => {
    if (!text.trim()) return;
    const q = text.trim();
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', text: answer(q) }]);
    }, 400);
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 380 }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={15} color="#58a6ff" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>AI Assistant</span>
        </div>
        <span className="badge-cyan">Gemini</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: m.role === 'user' ? '#1f6feb' : '#1c2128',
              border: m.role === 'user' ? 'none' : '1px solid #30363d',
              fontSize: 12,
              color: m.role === 'user' ? '#fff' : '#c9d1d9',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
              fontFamily: m.role === 'assistant' ? "'JetBrains Mono', monospace" : 'inherit',
            }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Quick Questions */}
      <div style={{ padding: '6px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => send(q)} style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid #30363d',
            background: 'transparent', color: '#58a6ff', fontSize: 10, cursor: 'pointer',
            fontWeight: 500, transition: 'all 0.15s',
          }}>
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #21262d', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Ask about failures, fixes, or test results..."
          className="input-field"
          style={{ flex: 1, fontSize: 12 }}
        />
        <button onClick={() => send(input)} className="btn-primary" style={{ padding: '7px 12px' }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ repairData, onNavigate }) {
  const { failures, history, loading, stats, apiHealth, refetch } = repairData;

  const [selectedFailureId, setSelectedFailureId] = useState(null);
  const [repairingId, setRepairingId] = useState(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [repairResult, setRepairResult] = useState(null);
  const [terminalLogs, setTerminalLogs] = useState([]);

  useEffect(() => {
    if (failures.length > 0 && !selectedFailureId) {
      setSelectedFailureId(failures[0].failureId);
    }
  }, [failures]);

  const addLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, { time, text, type }]);
  };

  const runRepair = async () => {
    if (!selectedFailureId || repairingId) return;
    setRepairingId(selectedFailureId);
    setRepairResult(null);
    setTerminalLogs([]);
    setActiveStep(0);

    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const selectedFailure = failures.find(f => f.failureId === selectedFailureId);

    addLog(`[SYSTEM] Starting repair pipeline for ${selectedFailureId}`, 'cyan');
    addLog(`[DETECT] API failure captured: ${selectedFailure?.error?.message?.split('\n')[0] || 'unknown'}`, 'error');

    try {
      // Animate through early steps while the API call runs
      const apiCall = axios.post('/api/repairs/run', { failureId: selectedFailureId });

      await delay(STEP_DELAY);
      setActiveStep(1);
      addLog('[ANALYZE] Parsing error type and stack trace...', 'info');

      await delay(STEP_DELAY);
      setActiveStep(2);
      addLog('[LOGS] Reading failure-report.json and code-locations.json...', 'info');
      addLog(`[LOGS] ${(selectedFailure?.fileSuspects || []).length} suspect file(s) identified`, 'info');

      await delay(STEP_DELAY);
      setActiveStep(3);
      addLog('[AI] Sending context to Gemini gemini-3.5-flash...', 'cyan');

      await delay(STEP_DELAY);
      setActiveStep(4);
      addLog(`[LOCATE] Targeting: ${(selectedFailure?.fileSuspects || []).map(s => s.file).join(', ')}`, 'info');

      await delay(STEP_DELAY);
      setActiveStep(5);
      addLog('[GEMINI] Generating minimal search/replace patch...', 'cyan');

      // Wait for actual API
      const res = await apiCall;
      const result = res.data.result;

      await delay(STEP_DELAY);
      setActiveStep(6);
      addLog('[TEST] Applying patch to isolated temp workspace...', 'info');
      addLog('[TEST] Running Jest/Supertest verification...', 'info');

      if (result.attempts?.length > 0) {
        const lastAttempt = result.attempts[result.attempts.length - 1];
        addLog(`[TEST] Jest output: ${lastAttempt.testOutput?.split('\n').find(l => l.includes('Tests:')) || 'tests completed'}`, 'info');
      }

      await delay(STEP_DELAY);
      setActiveStep(7);
      setRepairResult(result);

      if (result.status === 'FIX_VERIFIED') {
        addLog('[VERIFY] ✓ All tests passed — FIX VERIFIED', 'green');
        addLog(`[DB] Repair result saved to MongoDB (${result.failureId})`, 'green');
      } else {
        addLog(`[VERIFY] ✗ Repair failed after ${result.attempts?.length || 0} attempts`, 'error');
      }

      refetch();
    } catch (err) {
      addLog(`[ERROR] ${err.response?.data?.error || err.message}`, 'error');
      setRepairResult({ status: 'REPAIR_FAILED', failureId: selectedFailureId });
      setActiveStep(-1);
    } finally {
      setRepairingId(null);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.02em', marginBottom: 4 }}>RepairAI</h1>
          <p style={{ fontSize: 13, color: '#8b949e' }}>Autonomous API failure detection and repair · PS-04</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refetch} className="btn-secondary" disabled={loading}>
            <RefreshCw size={13} style={{ ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={() => onNavigate('api-monitor')} className="btn-primary">
            <Activity size={13} />
            Monitor APIs
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <StatCard label="APIs Monitored" value={stats.apisMonitored} sub="Endpoints tracked" accent="#58a6ff" />
        <StatCard label="Active Failures" value={stats.activeFailures} sub={stats.activeFailures > 0 ? 'Requires attention' : 'All healthy'} accent={stats.activeFailures > 0 ? '#f87171' : '#34d399'} />
        <StatCard label="Issues Repaired" value={stats.issuesRepaired} sub={`of ${history.length} total runs`} accent="#34d399" />
        <StatCard label="Success Rate" value={`${stats.successRate}%`} sub={history.length > 0 ? `${history.length} repair runs` : 'No data yet'} accent="#a78bfa" />
      </div>

      {/* Repair Pipeline Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={15} color="#58a6ff" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>Autonomous Repair Pipeline</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={selectedFailureId || ''}
              onChange={e => { setSelectedFailureId(e.target.value); setRepairResult(null); setActiveStep(-1); }}
              style={{
                background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
                padding: '5px 10px', fontSize: 12, color: '#e6edf3', outline: 'none',
              }}
            >
              <option value="">Select failure...</option>
              {failures.map(f => (
                <option key={f.failureId} value={f.failureId}>{f.failureId} — {f.describeBlock}</option>
              ))}
            </select>
            <button
              onClick={runRepair}
              disabled={!selectedFailureId || !!repairingId}
              className="btn-primary"
            >
              {repairingId ? <><RotateCcw size={13} style={{ animation: 'spin 1s linear infinite' }} />Running...</> : <><Play size={13} />Run AI Repair</>}
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 20px 16px' }}>
          <PipelineBar activeStep={activeStep} result={repairResult} />

          {/* Result banner */}
          {repairResult && (
            <div style={{
              marginTop: 14,
              padding: '10px 16px',
              borderRadius: 6,
              background: repairResult.status === 'FIX_VERIFIED' ? '#0e2d1e' : '#3d1c1c',
              border: `1px solid ${repairResult.status === 'FIX_VERIFIED' ? '#1a4a30' : '#5c2626'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              fontWeight: 600,
              color: repairResult.status === 'FIX_VERIFIED' ? '#34d399' : '#f87171',
            }} className="slide-in">
              {repairResult.status === 'FIX_VERIFIED'
                ? <><CheckCircle size={15} /> FIX VERIFIED — {repairResult.failureId} patched and all tests passed</>
                : <><XCircle size={15} /> REPAIR FAILED — {repairResult.failureId} could not be auto-repaired after {repairResult.attempts?.length || 0} attempt(s)</>
              }
              {repairResult.status === 'FIX_VERIFIED' && (
                <button onClick={() => onNavigate('code-fixes')} className="btn-secondary" style={{ marginLeft: 'auto', fontSize: 11 }}>
                  View Fix →
                </button>
              )}
            </div>
          )}

          {repairResult?.rootCause && (
            <div style={{
              marginTop: 10,
              padding: '8px 14px',
              background: '#0e2433',
              border: '1px solid #1a3d52',
              borderRadius: 6,
              fontSize: 12,
              color: '#8b949e',
            }}>
              <span style={{ color: '#22d3ee', fontWeight: 600 }}>Root Cause: </span>
              {repairResult.rootCause}
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout: API Health + Agent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>

        {/* API Health */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={15} color="#58a6ff" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>API Health Overview</span>
            </div>
            <button onClick={() => onNavigate('api-monitor')} style={{ fontSize: 11, color: '#58a6ff', background: 'none', border: 'none', cursor: 'pointer' }}>
              Full monitor →
            </button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Error</th>
                  <th>AI Status</th>
                </tr>
              </thead>
              <tbody>
                {apiHealth.map((ep, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge-${ep.method === 'GET' ? 'cyan' : ep.method === 'POST' ? 'amber' : 'red'} mono`} style={{ fontSize: 10 }}>
                        {ep.method}
                      </span>
                    </td>
                    <td><span className="mono" style={{ fontSize: 12, color: '#c9d1d9' }}>{ep.path}</span></td>
                    <td>
                      {ep.status === 'healthy'
                        ? <span className="badge-green">● Healthy</span>
                        : <span className="badge-red">● Failing</span>
                      }
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      <span style={{ fontSize: 11, color: '#8b949e', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ep.errorMsg || '—'}
                      </span>
                    </td>
                    <td>
                      {ep.aiStatus === 'FIX_VERIFIED' && <span className="badge-green">FIX VERIFIED</span>}
                      {ep.aiStatus === 'PENDING' && <span className="badge-amber">PENDING</span>}
                      {ep.aiStatus === 'OK' && <span className="badge-slate">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <AgentActivityFeed history={history} repairingId={repairingId} activeStep={activeStep} terminalLogs={terminalLogs} />
      </div>

      {/* AI Chat + Recent Failures */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 16 }}>
        <AiChat failures={failures} history={history} />

        {/* Recent Failures Table */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={15} color="#f87171" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>Recent API Failures</span>
            </div>
            <button onClick={() => onNavigate('error-logs')} style={{ fontSize: 11, color: '#58a6ff', background: 'none', border: 'none', cursor: 'pointer' }}>
              View logs →
            </button>
          </div>
          {failures.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#484f58', fontSize: 13 }}>
              <CheckCircle size={32} color="#22c55e" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p>No active failures</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Endpoint</th>
                    <th>Error</th>
                    <th>Suspects</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.slice(0, 8).map(f => (
                    <tr key={f.failureId}>
                      <td><span className="mono badge-red" style={{ fontSize: 10 }}>{f.failureId}</span></td>
                      <td><span className="mono" style={{ fontSize: 11, color: '#8b949e' }}>{f.describeBlock || f.testFile}</span></td>
                      <td style={{ maxWidth: 200 }}>
                        <span style={{ fontSize: 11, color: '#f87171', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.error?.message?.split('\n')[0]}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: '#8b949e' }}>
                          {(f.fileSuspects || []).map(s => s.file.split('/').pop()).join(', ')}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => { setSelectedFailureId(f.failureId); setRepairResult(null); setActiveStep(-1); window.scrollTo(0, 0); }}
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          Repair
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

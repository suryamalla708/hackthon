import { useState, useEffect } from 'react';
import axios from 'axios';
import { Bot, Bug, Clock, CheckCircle, XCircle, ChevronRight, Activity, TerminalSquare, SearchCode, Github } from 'lucide-react';

const API_BASE = '/api/repairs';

export default function App() {
  const [activeTab, setActiveTab] = useState('failures'); // 'failures' | 'history'
  const [failures, setFailures] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Repair state
  const [repairingId, setRepairingId] = useState(null);
  const [activeRepairResult, setActiveRepairResult] = useState(null);

  useEffect(() => {
    fetchFailures();
    fetchHistory();
  }, []);

  const fetchFailures = async () => {
    try {
      const res = await axios.get(`${API_BASE}/failures`);
      setFailures(res.data.failures || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`);
      setHistory(res.data.history || []);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerRepair = async (failureId) => {
    setRepairingId(failureId);
    setActiveRepairResult(null);
    try {
      const res = await axios.post(`${API_BASE}/run`, { failureId });
      setActiveRepairResult(res.data.result);
      fetchFailures();
      fetchHistory();
    } catch (err) {
      console.error(err);
      setActiveRepairResult({ error: err.response?.data?.error || err.message, status: 'REPAIR_FAILED' });
    } finally {
      setRepairingId(null);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl relative z-10">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-purple-200">RepairAI</h1>
            <p className="text-xs text-slate-400 font-medium">PS-04 Control Room</p>
          </div>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <button
            onClick={() => { setActiveTab('failures'); setActiveRepairResult(null); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'failures' 
                ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30 shadow-inner' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span className="font-medium">Active Failures</span>
            {failures.length > 0 && (
              <span className="ml-auto bg-red-500/20 text-red-400 py-0.5 px-2 rounded-full text-xs font-bold border border-red-500/20">
                {failures.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('history'); setActiveRepairResult(null); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'history' 
                ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30 shadow-inner' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="font-medium">Repair History</span>
          </button>
        </nav>

        {/* GitHub Optional Integration Mock */}
        <div className="p-4 mt-auto">
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center space-x-2 text-slate-300 mb-2">
              <Github className="w-4 h-4" />
              <span className="text-sm font-semibold">GitHub Integration</span>
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">Import repositories directly. (Auto-push disabled for safety).</p>
            <button disabled className="w-full text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2 rounded-lg font-medium transition-colors border border-slate-600">
              Connect Account
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <header className="h-16 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex items-center px-8 z-10 sticky top-0">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center space-x-2">
            {activeTab === 'failures' ? (
              <><Bug className="w-5 h-5 text-red-400" /><span>System Diagnostics</span></>
            ) : (
              <><Clock className="w-5 h-5 text-indigo-400" /><span>Automated Repair Logs</span></>
            )}
          </h2>
        </header>

        <div className="flex-1 overflow-auto p-8 relative z-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {activeTab === 'failures' && !activeRepairResult && (
              <div className="space-y-4">
                {failures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <CheckCircle className="w-16 h-16 text-emerald-500/50 mb-4" />
                    <p className="text-lg font-medium text-slate-300">All systems operational.</p>
                    <p className="text-sm">No active pipeline failures detected.</p>
                  </div>
                ) : (
                  failures.map(f => (
                    <div key={f.failureId} className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-colors shadow-lg">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase">
                              {f.failureId}
                            </span>
                            <h3 className="text-lg font-semibold text-slate-200">{f.testName}</h3>
                          </div>
                          <div className="bg-slate-950 rounded-lg p-3 border border-red-900/30 mt-3 inline-block">
                             <code className="text-red-400 text-sm font-mono">{f.error?.message?.split('\n')[0]}</code>
                          </div>
                        </div>
                        <button
                          onClick={() => triggerRepair(f.failureId)}
                          disabled={repairingId === f.failureId}
                          className="relative overflow-hidden group bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 border border-indigo-500/50 hover:border-indigo-400"
                        >
                          {repairingId === f.failureId ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              <span>Repairing...</span>
                            </>
                          ) : (
                            <>
                              <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
                              <span>Fix with AI</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-slate-400 mt-4">
                        <TerminalSquare className="w-4 h-4" />
                        <span>Suspect Files:</span>
                        <div className="flex space-x-2">
                          {f.fileSuspects.map(fsus => (
                             <span key={fsus.file} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono border border-slate-700">{fsus.file}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeRepairResult && (
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border-b border-slate-800 bg-slate-800/30 p-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold flex items-center space-x-3">
                      <span>Repair Report</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase border ${
                        activeRepairResult.status === 'FIX_VERIFIED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {activeRepairResult.status}
                      </span>
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">ID: <span className="font-mono text-slate-300">{activeRepairResult.failureId}</span></p>
                  </div>
                  <button onClick={() => setActiveRepairResult(null)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-2 rounded-lg">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6 space-y-8">
                  {/* Root Cause & Explanation */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2 flex items-center space-x-2">
                        <SearchCode className="w-4 h-4" /> <span>Identified Root Cause</span>
                      </h4>
                      <p className="text-slate-300 leading-relaxed text-sm">{activeRepairResult.rootCause}</p>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">Explanation</h4>
                      <p className="text-slate-300 leading-relaxed text-sm">{activeRepairResult.explanation}</p>
                    </div>
                  </div>

                  {/* Patch Viewer */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center space-x-2">
                      <TerminalSquare className="w-4 h-4" /> <span>Applied Patch (Diff)</span>
                    </h4>
                    {activeRepairResult.attempts?.map((attempt, idx) => (
                      <div key={idx} className="mb-6 rounded-xl overflow-hidden border border-slate-800 shadow-xl bg-[#0d1117]">
                        <div className="bg-[#161b22] px-4 py-2 border-b border-slate-800 text-xs text-slate-400 font-mono flex justify-between">
                           <span>Attempt {attempt.attemptNumber}</span>
                           <span>{attempt.testOutput?.includes('failed') ? '❌ Failed' : '✅ Passed'}</span>
                        </div>
                        <div className="flex flex-col font-mono text-sm leading-relaxed overflow-x-auto">
                          <pre className="p-4 bg-[#ffebe9]/5 text-[#ff8182] border-l-4 border-[#ff8182]">
                            <span className="opacity-50 select-none mr-4">-</span>
                            {attempt.search}
                          </pre>
                          <pre className="p-4 bg-[#e6ffed]/5 text-[#7ee787] border-l-4 border-[#7ee787]">
                            <span className="opacity-50 select-none mr-4">+</span>
                            {attempt.replace}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && !activeRepairResult && (
              <div className="space-y-4">
                {history.map(h => (
                  <div key={h._id} 
                       onClick={() => setActiveRepairResult(h)}
                       className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 p-5 rounded-xl hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all cursor-pointer group flex justify-between items-center shadow-lg">
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                          h.status === 'FIX_VERIFIED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {h.status}
                        </span>
                        <span className="text-slate-500 text-xs font-mono">{new Date(h.createdAt).toLocaleString()}</span>
                      </div>
                      <h4 className="font-medium text-slate-200 mt-2">{h.testName}</h4>
                      <p className="text-xs text-slate-400 mt-1 truncate max-w-2xl">{h.rootCause}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-center py-20 text-slate-500">
                    <p>No repair history found.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

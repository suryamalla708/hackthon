import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Bot, Bug, Clock, CheckCircle, XCircle, ChevronRight, Activity, 
  TerminalSquare, SearchCode, GitBranch, Settings, Folder, FileCode, 
  History, Sparkles, Cpu, Database, AlertTriangle, RefreshCw, Play, 
  X, ChevronDown, Layers, Globe, Terminal, Code, HelpCircle 
} from 'lucide-react';

const API_BASE = '/api/repairs';

export default function App() {
  const [activeTab, setActiveTab] = useState('control-room'); // 'control-room' | 'history' | 'github' | 'settings'
  const [failures, setFailures] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedFailure, setSelectedFailure] = useState(null);
  
  // Repair Execution States
  const [repairingId, setRepairingId] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(null); // 'idle' | 'failure' | 'investigate' | 'diagnosis' | 'patch' | 'testing' | 'retry' | 'verified' | 'failed'
  const [activeRepairResult, setActiveRepairResult] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [terminalLogs, setTerminalLogs] = useState([]);

  // Mock settings & imports
  const [githubUrl, setGithubUrl] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [settings, setSettings] = useState({
    autoRepair: false,
    maxAttempts: 3,
    modelName: 'gemini-3.5-flash',
    tempDir: './backend_temp',
    timeout: 30
  });

  // UI state
  const [selectedFile, setSelectedFile] = useState('src/controllers/productController.js');
  const [fileContents, setFileContents] = useState({});
  const consoleEndRef = useRef(null);

  useEffect(() => {
    fetchFailures();
    fetchHistory();
    fetchSourceFiles();
  }, []);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const addLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, { time, text, type }]);
  };

  const fetchFailures = async () => {
    try {
      const res = await axios.get(`${API_BASE}/failures`);
      const list = res.data.failures || [];
      setFailures(list);
      if (list.length > 0 && !selectedFailure) {
        setSelectedFailure(list[0]);
      }
    } catch (err) {
      addLog(`Failed to fetch active failures: ${err.message}`, 'error');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`);
      setHistory(res.data.history || []);
    } catch (err) {
      addLog(`Failed to fetch repair history: ${err.message}`, 'error');
    }
  };

  const fetchSourceFiles = async () => {
    // Basic mock file explorer contents
    setFileContents({
      'src/controllers/productController.js': `// Product Controller - seeded with Bug B2 and B4\nconst Product = require('../models/Product');\n\nexports.createProduct = async (req, res, next) => {\n  try {\n    const product = new Product(req.body);\n    // BUG B2: missing await\n    const savedProduct = product.save();\n    res.status(201).json(savedProduct);\n  } catch (err) {\n    next(err);\n  }\n};`,
      'src/controllers/userController.js': `// User Controller - seeded with Bug B1\nconst User = require('../models/User');\n\nexports.createUser = async (req, res, next) => {\n  try {\n    // BUG B1: reading username instead of name\n    const name = req.body.username;\n    const user = new User({ name });\n    await user.save();\n    res.status(201).json(user);\n  } catch (err) {\n    next(err);\n  }\n};`,
      'src/routes/users.js': `// Users Routes - seeded with Bug B3\nconst express = require('express');\nconst router = express.Router();\nconst userController = require('../controllers/userController');\n\n// BUG B3: registered as PUT instead of DELETE\nrouter.put('/:id', userController.deleteUser);\n\nmodule.exports = router;`,
      'src/middleware/errorHandler.js': `// Error Handler - seeded with Bug B5\n// BUG B5: missing 4th err parameter\nmodule.exports = (req, res, next) => {\n  console.error('API Error');\n  res.status(500).json({ error: 'Internal Server Error' });\n};`
    });
  };

  const runMockPipelineAnimation = async (result) => {
    // Animated transitions to make the hackathon demo look impressive
    setPipelineStep('failure');
    setTerminalLogs([]);
    addLog(`[CRITICAL] Failure triggered for ID: ${result.failureId}`, 'error');
    await new Promise(r => setTimeout(r, 1200));

    setPipelineStep('investigate');
    addLog(`[AGENT] Starting failure analysis pipeline...`, 'cyan');
    addLog(`[AGENT] Scanning logs/failure-report.json`, 'info');
    addLog(`[AGENT] Extracted stack trace: ${result.errorMsg}`, 'info');
    await new Promise(r => setTimeout(r, 1500));

    setPipelineStep('diagnosis');
    addLog(`[GEMINI] Calling Gemini API (model: ${settings.modelName})...`, 'cyan');
    addLog(`[GEMINI] Sending target file and diagnostics context...`, 'info');
    await new Promise(r => setTimeout(r, 1500));

    if (result.attempts && result.attempts.length > 0) {
      for (let i = 0; i < result.attempts.length; i++) {
        const attempt = result.attempts[i];
        setCurrentAttempt(attempt.attemptNumber);
        
        setPipelineStep('patch');
        addLog(`[PATCH] AI identified root cause: "${result.rootCause || 'Stale code structure'}"`, 'cyan');
        addLog(`[PATCH] Generating patch chunk (Attempt ${attempt.attemptNumber}/${settings.maxAttempts})...`, 'info');
        addLog(`[PATCH] Target line patch generated.`, 'info');
        await new Promise(r => setTimeout(r, 1500));

        setPipelineStep('testing');
        addLog(`[TEST] Creating isolated temporary workspace: ${settings.tempDir}`, 'info');
        addLog(`[TEST] Executing Jest target test cases...`, 'cyan');
        await new Promise(r => setTimeout(r, 1500));

        if (attempt.testOutput && attempt.testOutput.includes('failed') && i < result.attempts.length - 1) {
          setPipelineStep('retry');
          addLog(`[TEST] Jest verification FAILED! Sending error feedback back to Gemini.`, 'error');
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    }

    if (result.status === 'FIX_VERIFIED') {
      setPipelineStep('verified');
      addLog(`[VERIFY] Verification SUCCESSFUL. Jest tests passed cleanly!`, 'green');
      addLog(`[SUCCESS] Fix verified and recorded in MongoDB database.`, 'green');
    } else {
      setPipelineStep('failed');
      addLog(`[VERIFY] All repair attempts failed. Status marked as REPAIR_FAILED.`, 'error');
    }
  };

  const triggerRepair = async (failureId) => {
    setRepairingId(failureId);
    setActiveRepairResult(null);
    setPipelineStep('idle');
    setTerminalLogs([]);
    
    addLog(`[SYSTEM] Starting repair flow for ${failureId}...`, 'info');

    try {
      const res = await axios.post(`${API_BASE}/run`, { failureId });
      const result = res.data.result;
      setActiveRepairResult(result);
      
      // Run the detailed animation loop
      await runMockPipelineAnimation(result);
      
      fetchFailures();
      fetchHistory();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      addLog(`[FATAL] Repair request failed: ${errorMsg}`, 'error');
      setPipelineStep('failed');
      setActiveRepairResult({ 
        failureId,
        errorMsg: errorMsg,
        rootCause: 'Connection error / Timeout',
        explanation: 'The repair execution could not be completed successfully.',
        status: 'REPAIR_FAILED',
        attempts: [{ attemptNumber: 1, search: '', replace: '', testOutput: errorMsg }]
      });
    } finally {
      setRepairingId(null);
    }
  };

  const handleImportGithub = (e) => {
    e.preventDefault();
    if (!githubUrl) return;
    setImportStatus('connecting');
    setTimeout(() => {
      setImportStatus('cloning');
      setTimeout(() => {
        setImportStatus('analyzing');
        setTimeout(() => {
          setImportStatus('success');
          addLog(`[GITHUB] Successfully imported repository: ${githubUrl}`, 'cyan');
        }, 1500);
      }, 1500);
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-[#0d0f12] text-[#d1d5db] overflow-hidden font-mono text-sm antialiased border-4 border-[#1e293b]">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0a0c0e] border-r border-[#1f242e] flex flex-col justify-between select-none">
        <div>
          {/* Brand header */}
          <div className="p-5 border-b border-[#1f242e] flex items-center space-x-3 bg-[#0c0e11]">
            <div className="bg-[#0f172a] p-1.5 rounded border border-[#22d3ee]/30 animate-pulse">
              <Bot className="w-5 h-5 text-[#22d3ee]" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-widest text-[#22d3ee]">REPAIR_AI</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Control Panel v1.0.4</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => { setActiveTab('control-room'); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-colors ${
                activeTab === 'control-room' 
                  ? 'bg-[#161a22] text-[#22d3ee] border-l-2 border-[#22d3ee] font-bold' 
                  : 'text-slate-400 hover:bg-[#0c0f14] hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Control Room</span>
            </button>
            <button
              onClick={() => { setActiveTab('history'); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-colors ${
                activeTab === 'history' 
                  ? 'bg-[#161a22] text-[#22d3ee] border-l-2 border-[#22d3ee] font-bold' 
                  : 'text-slate-400 hover:bg-[#0c0f14] hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Repair Archive</span>
            </button>
            <button
              onClick={() => { setActiveTab('github'); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-colors ${
                activeTab === 'github' 
                  ? 'bg-[#161a22] text-[#22d3ee] border-l-2 border-[#22d3ee] font-bold' 
                  : 'text-slate-400 hover:bg-[#0c0f14] hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>GitHub Import</span>
            </button>
            <button
              onClick={() => { setActiveTab('settings'); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-colors ${
                activeTab === 'settings' 
                  ? 'bg-[#161a22] text-[#22d3ee] border-l-2 border-[#22d3ee] font-bold' 
                  : 'text-slate-400 hover:bg-[#0c0f14] hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* AI Model Status Card */}
        <div className="p-4 border-t border-[#1f242e] bg-[#080a0c]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">AI/LLM STATUS</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Model:</span>
              <span className="text-slate-300 font-bold font-mono">gemini-3.5-flash</span>
            </div>
            <div className="flex justify-between">
              <span>API Key:</span>
              <span className="text-[#22d3ee] font-mono">ACTIVE (ENV)</span>
            </div>
            <div className="flex justify-between">
              <span>Attempts:</span>
              <span className="text-slate-300">Max 3</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0c0e12] relative">
        
        {/* Technical Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1b202e_1px,transparent_1px),linear-gradient(to_bottom,#1b202e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.12] pointer-events-none"></div>

        {/* Header bar */}
        <header className="h-14 border-b border-[#1f242e] flex items-center justify-between px-6 bg-[#0a0c0e] relative z-10">
          <div className="flex items-center space-x-3">
            <Activity className="w-4 h-4 text-[#22d3ee]" />
            <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">
              {activeTab === 'control-room' ? 'AI REPAIR PIPELINE CONTROL ROOM' : `${activeTab.replace('-', ' ')}`}
            </span>
          </div>
          <div className="flex items-center space-x-4 text-xs text-slate-500">
            <span className="flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>MongoDB Memory Server:</span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </span>
            <span>|</span>
            <span className="text-slate-400 font-bold">{failures.length} active failures detected</span>
          </div>
        </header>

        {/* Main Workspaces */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          
          {activeTab === 'control-room' && (
            <>
              {/* Left Column: Failure Explorer & Workspace Files */}
              <div className="w-80 border-r border-[#1f242e] flex flex-col bg-[#090b0e] select-none">
                
                {/* Active Failures Header */}
                <div className="p-3 border-b border-[#1f242e] bg-[#0c0e13] flex items-center justify-between">
                  <span className="text-xs font-bold tracking-widest text-[#ef4444] uppercase flex items-center space-x-1.5">
                    <Bug className="w-4 h-4" /> <span>API FAILURES</span>
                  </span>
                  <span className="bg-red-950 text-[#ef4444] text-[10px] font-bold px-2 py-0.5 rounded border border-red-800/40">
                    {failures.length} ACTIVE
                  </span>
                </div>

                {/* Failure List */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#181d27]">
                  {failures.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center h-48">
                      <CheckCircle className="w-10 h-10 text-emerald-500/50 mb-3" />
                      <p className="text-xs font-bold text-slate-400">Pipeline operational</p>
                      <p className="text-[10px] text-slate-500 mt-1">Zero failures logged</p>
                    </div>
                  ) : (
                    failures.map(f => (
                      <div 
                        key={f.failureId}
                        onClick={() => { setSelectedFailure(f); setActiveRepairResult(null); setPipelineStep('idle'); }}
                        className={`p-3.5 cursor-pointer transition-all ${
                          selectedFailure?.failureId === f.failureId 
                            ? 'bg-[#141822] border-l-4 border-red-500' 
                            : 'hover:bg-[#0c0e14]/60'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="text-[10px] font-bold font-mono text-red-400 tracking-wider">
                            {f.failureId}
                          </span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono font-bold">
                            {f.describeBlock?.split(' ')[0] || 'POST'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-300 leading-normal line-clamp-2">
                          {f.testName}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-1">
                          File: {f.testFile}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Project File Explorer Header */}
                <div className="p-3 border-t border-b border-[#1f242e] bg-[#0c0e13] flex items-center space-x-2">
                  <Folder className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">PROJECT FILES</span>
                </div>

                {/* File Tree */}
                <div className="p-3 space-y-1 overflow-y-auto bg-[#08090c] text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-500 py-1">
                    <Folder className="w-3.5 h-3.5" />
                    <span>src/controllers</span>
                  </div>
                  <div className="pl-4 space-y-1">
                    <button 
                      onClick={() => setSelectedFile('src/controllers/productController.js')}
                      className={`flex items-center space-x-1.5 py-1 w-full text-left rounded ${selectedFile === 'src/controllers/productController.js' ? 'text-[#22d3ee] font-bold' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>productController.js</span>
                    </button>
                    <button 
                      onClick={() => setSelectedFile('src/controllers/userController.js')}
                      className={`flex items-center space-x-1.5 py-1 w-full text-left rounded ${selectedFile === 'src/controllers/userController.js' ? 'text-[#22d3ee] font-bold' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>userController.js</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-500 py-1">
                    <Folder className="w-3.5 h-3.5" />
                    <span>src/routes</span>
                  </div>
                  <div className="pl-4">
                    <button 
                      onClick={() => setSelectedFile('src/routes/users.js')}
                      className={`flex items-center space-x-1.5 py-1 w-full text-left rounded ${selectedFile === 'src/routes/users.js' ? 'text-[#22d3ee] font-bold' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>users.js</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-500 py-1">
                    <Folder className="w-3.5 h-3.5" />
                    <span>src/middleware</span>
                  </div>
                  <div className="pl-4">
                    <button 
                      onClick={() => setSelectedFile('src/middleware/errorHandler.js')}
                      className={`flex items-center space-x-1.5 py-1 w-full text-left rounded ${selectedFile === 'src/middleware/errorHandler.js' ? 'text-[#22d3ee] font-bold' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>errorHandler.js</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Center Panel: Active Failure details + Repair Visualizer */}
              <div className="flex-1 flex flex-col bg-[#0b0c10] overflow-y-auto custom-scrollbar">
                
                {selectedFailure ? (
                  <div className="p-6 space-y-6">
                    {/* Active Failure Header card */}
                    <div className="bg-[#0e1015] border border-[#1f242e] rounded p-4 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ef4444]"></div>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold tracking-widest text-[#ef4444] uppercase font-mono">
                            API FAILURE REGISTERED
                          </span>
                          <h3 className="text-base font-bold text-slate-100">{selectedFailure.testName}</h3>
                          <p className="text-xs text-slate-400 font-mono">
                            Endpoint: {selectedFailure.describeBlock}
                          </p>
                        </div>

                        <button
                          onClick={() => triggerRepair(selectedFailure.failureId)}
                          disabled={repairingId === selectedFailure.failureId}
                          className="relative overflow-hidden group bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444] text-[#ef4444] px-5 py-2 rounded text-xs font-bold tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shrink-0"
                        >
                          {repairingId === selectedFailure.failureId ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-[#ef4444]" />
                              <span>PIPELINE RUNNING...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-[#ef4444]" />
                              <span>START AI REPAIR</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Error Preview */}
                      <div className="mt-4 bg-[#07090c] p-3 rounded border border-red-950/60">
                        <div className="flex items-center space-x-1.5 mb-2 text-xs text-[#ef4444] font-bold font-mono">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>EXPRESS EXCEPTION CAPTURED</span>
                        </div>
                        <pre className="text-xs text-red-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
                          {selectedFailure.error?.message}
                        </pre>
                      </div>
                    </div>

                    {/* LIVE REPAIR PIPELINE ANIMATION STAGES */}
                    <div className="bg-[#0e1015] border border-[#1f242e] rounded p-5 relative">
                      <div className="flex items-center justify-between mb-4 border-b border-[#1f242e] pb-3">
                        <span className="text-xs font-bold tracking-widest text-[#22d3ee] uppercase flex items-center space-x-2">
                          <Activity className="w-4 h-4 text-[#22d3ee]" />
                          <span>LIVE REPAIR PIPELINE</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold font-mono uppercase tracking-wider">
                          STATUS: {pipelineStep?.toUpperCase() || 'IDLE'}
                        </span>
                      </div>

                      {/* Pipeline Graph visualization */}
                      <div className="grid grid-cols-7 gap-1.5 relative items-center py-4 bg-[#0a0c0f] rounded px-3 border border-[#1b202c]">
                        
                        {/* Step 1: Failure */}
                        <div className={`flex flex-col items-center p-2 rounded text-center transition-all ${
                          pipelineStep === 'failure' 
                            ? 'bg-red-950/30 border border-red-500/50 shadow-[0_0_8px_#ef4444_inset]' 
                            : 'bg-transparent border border-transparent'
                        }`}>
                          <Bug className={`w-5 h-5 mb-1.5 ${pipelineStep === 'failure' ? 'text-red-500 animate-bounce' : 'text-slate-600'}`} />
                          <span className="text-[10px] font-bold tracking-wider">FAILURE</span>
                        </div>

                        {/* Connection arrow */}
                        <div className="flex justify-center">
                          <ChevronRight className={`w-4 h-4 ${pipelineStep === 'investigate' ? 'text-[#22d3ee] animate-pulse' : 'text-slate-600'}`} />
                        </div>

                        {/* Step 2: Investigate */}
                        <div className={`flex flex-col items-center p-2 rounded text-center transition-all ${
                          pipelineStep === 'investigate' 
                            ? 'bg-[#162e3d] border border-[#22d3ee]/60 shadow-[0_0_8px_#22d3ee_inset]' 
                            : 'bg-transparent border border-transparent'
                        }`}>
                          <SearchCode className={`w-5 h-5 mb-1.5 ${pipelineStep === 'investigate' ? 'text-[#22d3ee] animate-spin' : 'text-slate-600'}`} />
                          <span className="text-[10px] font-bold tracking-wider">SCAN</span>
                        </div>

                        {/* Connection arrow */}
                        <div className="flex justify-center">
                          <ChevronRight className={`w-4 h-4 ${pipelineStep === 'diagnosis' ? 'text-[#22d3ee] animate-pulse' : 'text-slate-600'}`} />
                        </div>

                        {/* Step 3: Diagnosis */}
                        <div className={`flex flex-col items-center p-2 rounded text-center transition-all ${
                          pipelineStep === 'diagnosis' 
                            ? 'bg-[#162e3d] border border-[#22d3ee]/60 shadow-[0_0_8px_#22d3ee_inset]' 
                            : 'bg-transparent border border-transparent'
                        }`}>
                          <Bot className={`w-5 h-5 mb-1.5 ${pipelineStep === 'diagnosis' ? 'text-[#22d3ee] animate-pulse' : 'text-slate-600'}`} />
                          <span className="text-[10px] font-bold tracking-wider">LLM</span>
                        </div>

                        {/* Connection arrow */}
                        <div className="flex justify-center">
                          <ChevronRight className={`w-4 h-4 ${pipelineStep === 'patch' ? 'text-[#22d3ee] animate-pulse' : 'text-slate-600'}`} />
                        </div>

                        {/* Step 4: Patch */}
                        <div className={`flex flex-col items-center p-2 rounded text-center transition-all ${
                          pipelineStep === 'patch' 
                            ? 'bg-[#162e3d] border border-[#22d3ee]/60 shadow-[0_0_8px_#22d3ee_inset]' 
                            : 'bg-transparent border border-transparent'
                        }`}>
                          <Code className={`w-5 h-5 mb-1.5 ${pipelineStep === 'patch' ? 'text-[#22d3ee] animate-bounce' : 'text-slate-600'}`} />
                          <span className="text-[10px] font-bold tracking-wider">PATCH</span>
                        </div>

                        {/* Connection arrow */}
                        <div className="flex justify-center">
                          <ChevronRight className={`w-4 h-4 ${pipelineStep === 'testing' ? 'text-[#22d3ee] animate-pulse' : 'text-slate-600'}`} />
                        </div>

                        {/* Step 5: Testing */}
                        <div className={`flex flex-col items-center p-2 rounded text-center transition-all ${
                          pipelineStep === 'testing' 
                            ? 'bg-[#162e3d] border border-[#22d3ee]/60 shadow-[0_0_8px_#22d3ee_inset]' 
                            : 'bg-transparent border border-transparent'
                        }`}>
                          <TerminalSquare className={`w-5 h-5 mb-1.5 ${pipelineStep === 'testing' ? 'text-[#22d3ee] animate-pulse' : 'text-slate-600'}`} />
                          <span className="text-[10px] font-bold tracking-wider">TEST</span>
                        </div>

                        {/* Connection arrow */}
                        <div className="flex justify-center">
                          <ChevronRight className={`w-4 h-4 ${pipelineStep === 'retry' ? 'text-[#ef4444] animate-pulse' : 'text-slate-600'}`} />
                        </div>

                        {/* Step 6: Retry */}
                        <div className={`flex flex-col items-center p-2 rounded text-center transition-all ${
                          pipelineStep === 'retry' 
                            ? 'bg-red-950/30 border border-red-500/50 shadow-[0_0_8px_#ef4444_inset]' 
                            : 'bg-transparent border border-transparent'
                        }`}>
                          <RefreshCw className={`w-5 h-5 mb-1.5 ${pipelineStep === 'retry' ? 'text-red-500 animate-spin' : 'text-slate-600'}`} />
                          <span className="text-[10px] font-bold tracking-wider">RETRY {currentAttempt}/3</span>
                        </div>

                        {/* Connection arrow */}
                        <div className="flex justify-center">
                          <ChevronRight className={`w-4 h-4 ${pipelineStep === 'verified' ? 'text-emerald-500 animate-pulse' : 'text-slate-600'}`} />
                        </div>

                        {/* Step 7: Verified */}
                        <div className={`flex flex-col items-center p-2 rounded text-center transition-all ${
                          pipelineStep === 'verified' 
                            ? 'bg-emerald-950/30 border border-emerald-500/50 shadow-[0_0_8px_#10b981_inset]' 
                            : pipelineStep === 'failed'
                            ? 'bg-red-950/30 border border-red-500/50 shadow-[0_0_8px_#ef4444_inset]'
                            : 'bg-transparent border border-transparent'
                        }`}>
                          {pipelineStep === 'failed' ? (
                            <>
                              <XCircle className="w-5 h-5 mb-1.5 text-red-500 animate-pulse" />
                              <span className="text-[10px] font-bold tracking-wider text-red-500">FAILED</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className={`w-5 h-5 mb-1.5 ${pipelineStep === 'verified' ? 'text-emerald-500 animate-bounce' : 'text-slate-600'}`} />
                              <span className="text-[10px] font-bold tracking-wider">VERIFIED</span>
                            </>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* AI Diagnosis report details when finished or active */}
                    {activeRepairResult && (
                      <div className="bg-[#0e1015] border border-[#1f242e] rounded p-5 space-y-6">
                        <div className="flex justify-between items-center border-b border-[#1f242e] pb-3">
                          <span className="text-xs font-bold tracking-widest text-[#22d3ee] uppercase flex items-center space-x-1.5">
                            <Sparkles className="w-4 h-4" /> <span>AI REPAIR REPORT</span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            activeRepairResult.status === 'FIX_VERIFIED' 
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40' 
                              : 'bg-red-950 text-red-400 border-red-800/40'
                          }`}>
                            {activeRepairResult.status}
                          </span>
                        </div>

                        {/* Diagnosis content card */}
                        <div className="space-y-4">
                          <div className="bg-[#090b0e] p-4 rounded border border-[#1f242e]">
                            <h4 className="text-xs font-bold text-[#22d3ee] uppercase tracking-wider mb-2 font-mono">
                              ROOT CAUSE ANALYSIS
                            </h4>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {activeRepairResult.rootCause}
                            </p>
                            <h4 className="text-xs font-bold text-[#22d3ee] uppercase tracking-wider mt-4 mb-2 font-mono">
                              EXPLANATION
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {activeRepairResult.explanation}
                            </p>
                          </div>

                          {/* Code patch diff view */}
                          {activeRepairResult.attempts?.map((attempt, idx) => (
                            <div key={idx} className="border border-[#1f242e] rounded overflow-hidden">
                              <div className="bg-[#0c0e12] px-3 py-1.5 border-b border-[#1f242e] text-[10px] text-slate-400 font-mono flex justify-between">
                                <span>Attempt #{attempt.attemptNumber} Patch Diff</span>
                                <span className={attempt.testOutput?.includes('failed') ? 'text-red-400' : 'text-emerald-400'}>
                                  {attempt.testOutput?.includes('failed') ? 'TESTS FAILED' : 'TESTS PASSED'}
                                </span>
                              </div>
                              <div className="font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed bg-[#06080b]">
                                <div className="bg-red-950/20 text-red-300 p-3 border-l-2 border-red-500">
                                  <span className="text-red-500 mr-2 select-none">-</span>
                                  {attempt.search}
                                </div>
                                <div className="bg-emerald-950/20 text-emerald-300 p-3 border-l-2 border-emerald-500">
                                  <span className="text-emerald-500 mr-2 select-none">+</span>
                                  {attempt.replace}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                    <Activity className="w-16 h-16 text-slate-700 animate-pulse mb-4" />
                    <h3 className="text-base font-bold text-slate-400 uppercase tracking-widest">
                      SELECT AN ACTIVE FAILURE
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                      Select one of the captured Express pipeline failures in the left bar to analyze, debug and apply AI code patches.
                    </p>
                  </div>
                )}

              </div>

              {/* Right Column: Console / Active Log panel */}
              <div className="w-80 border-l border-[#1f242e] flex flex-col bg-[#090b0e]">
                
                {/* Console Terminal Header */}
                <div className="p-3 border-b border-[#1f242e] bg-[#0c0e13] flex items-center justify-between">
                  <span className="text-xs font-bold tracking-widest text-[#22d3ee] uppercase flex items-center space-x-1.5">
                    <Terminal className="w-4 h-4" /> <span>CONSOLE LOGS</span>
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                </div>

                {/* Log Stream */}
                <div className="flex-1 p-3 overflow-y-auto bg-[#07080b] font-mono text-[10px] space-y-2.5 select-text">
                  {terminalLogs.length === 0 ? (
                    <div className="text-slate-600 italic">
                      Console idle. Start a repair session to capture live execution stream...
                    </div>
                  ) : (
                    terminalLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed">
                        <span className="text-slate-600 mr-1.5">[{log.time}]</span>
                        <span className={
                          log.type === 'error' ? 'text-red-400 font-bold' : 
                          log.type === 'green' ? 'text-emerald-400 font-bold' :
                          log.type === 'cyan' ? 'text-[#22d3ee]' : 
                          'text-slate-400'
                        }>
                          {log.text}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={consoleEndRef} />
                </div>

                {/* Source code preview helper card */}
                <div className="p-3 border-t border-[#1f242e] bg-[#0c0e13] flex flex-col space-y-2">
                  <div className="flex items-center space-x-1.5">
                    <Code className="w-4 h-4 text-[#22d3ee]" />
                    <span className="text-xs font-bold text-slate-300 uppercase">File Inspector</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono truncate">{selectedFile}</span>
                  
                  <div className="bg-[#050608] p-2.5 rounded border border-[#1f242e] overflow-x-auto text-[10px] font-mono leading-relaxed h-52 text-slate-400">
                    <pre className="whitespace-pre">
                      {fileContents[selectedFile] || '// Select a project file to inspect'}
                    </pre>
                  </div>
                </div>

              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex justify-between items-center border-b border-[#1f242e] pb-3 mb-6">
                  <h3 className="text-sm font-bold tracking-widest text-[#22d3ee] uppercase flex items-center space-x-2">
                    <History className="w-5 h-5 text-[#22d3ee]" />
                    <span>AUTOMATED REPAIR LOG ARCHIVE</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">{history.length} records retrieved from MongoDB</span>
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 italic">
                    No historical logs captured. Run repairs to populate the database.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map(h => (
                      <div 
                        key={h._id}
                        className="bg-[#0e1015] border border-[#1f242e] rounded p-4 flex justify-between items-center hover:border-indigo-500/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-[10px] font-mono">
                            <span className={`px-2 py-0.2 rounded font-bold border ${
                              h.status === 'FIX_VERIFIED' 
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40' 
                                : 'bg-red-950 text-red-400 border-red-800/40'
                            }`}>
                              {h.status}
                            </span>
                            <span className="text-slate-500">{new Date(h.createdAt).toLocaleString()}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-300 mt-2">{h.testName}</h4>
                          <p className="text-xs text-slate-400">{h.rootCause}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-xl mx-auto bg-[#0e1015] border border-[#1f242e] rounded p-6 space-y-6">
                <div className="border-b border-[#1f242e] pb-3 flex items-center space-x-2">
                  <GitBranch className="w-5 h-5 text-[#22d3ee]" />
                  <h3 className="text-sm font-bold tracking-widest text-[#22d3ee] uppercase">
                    IMPORT GITHUB REPOSITORY
                  </h3>
                </div>

                <form onSubmit={handleImportGithub} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Repository Link</label>
                    <input 
                      type="text"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username/project" 
                      className="w-full bg-[#050608] border border-[#1f242e] rounded p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#22d3ee] font-mono"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 text-[#22d3ee] border border-[#22d3ee] rounded p-2.5 text-xs font-bold tracking-wider transition-colors"
                  >
                    CONNECT REPOSITORY
                  </button>
                </form>

                {importStatus && (
                  <div className="bg-[#07090c] p-4 rounded border border-[#1f242e] space-y-2">
                    <div className="flex items-center space-x-2 text-xs font-bold font-mono">
                      <RefreshCw className={`w-3.5 h-3.5 ${importStatus !== 'success' ? 'animate-spin' : ''}`} />
                      <span>
                        {importStatus === 'connecting' && 'Connecting to GitHub api...'}
                        {importStatus === 'cloning' && 'Cloning target workspace folders...'}
                        {importStatus === 'analyzing' && 'Running static AST analysis...'}
                        {importStatus === 'success' && 'REPOSITORY READY'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-xl mx-auto bg-[#0e1015] border border-[#1f242e] rounded p-6 space-y-6">
                <div className="border-b border-[#1f242e] pb-3 flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-[#22d3ee]" />
                  <h3 className="text-sm font-bold tracking-widest text-[#22d3ee] uppercase">
                    SYSTEM SETTINGS
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center py-2.5 border-b border-[#181d27]">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-300">AUTO-APPLY REPAIRS</span>
                      <p className="text-[10px] text-slate-500">Automatically patch source code files on verified success</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.autoRepair} 
                      onChange={(e) => setSettings({...settings, autoRepair: e.target.checked})}
                      className="accent-[#22d3ee]"
                    />
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-[#181d27]">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-300">MAX ATTEMPTS LIMIT</span>
                      <p className="text-[10px] text-slate-500">Maximum LLM generation retries per pipeline fail</p>
                    </div>
                    <span className="font-bold text-[#22d3ee]">{settings.maxAttempts} ATTEMPTS</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-[#181d27]">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-300">TARGET MODEL</span>
                      <p className="text-[10px] text-slate-500">Currently active LLM model engine in backend env</p>
                    </div>
                    <span className="font-bold text-slate-300">{settings.modelName}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}

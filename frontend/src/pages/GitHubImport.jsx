import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  GitFork, Search, Download, FolderTree, Package, TestTube2, Zap, CheckCircle,
  XCircle, Loader, Trash2, ChevronRight, AlertCircle, ExternalLink, RotateCcw, FileCode, Box, Clock
} from 'lucide-react';

const IMPORT_STEPS = [
  { id: 'validate', label: 'Validate URL',    icon: Search,     color: 'text-violet-400' },
  { id: 'clone',    label: 'Clone Repo',      icon: Download,   color: 'text-blue-400' },
  { id: 'detect',   label: 'Detect Project',  icon: FolderTree, color: 'text-cyan-400' },
  { id: 'install',  label: 'Install Deps',    icon: Package,    color: 'text-amber-400' },
  { id: 'analyze',  label: 'Run Analysis',    icon: TestTube2,  color: 'text-orange-400' },
  { id: 'ready',    label: 'Ready',           icon: CheckCircle,color: 'text-green-400' },
];

const STATUS_TO_STEP = {
  CLONING: 1,
  DETECTING: 2,
  INSTALLING: 3,
  ANALYZING: 4,
  READY: 5,
  FAILED: -1,
};

function PipelineProgress({ currentStep, failed }) {
  return (
    <div className="flex items-center gap-0 py-2 w-full overflow-x-auto pb-4 scrollbar-none">
      {IMPORT_STEPS.map((step, i) => {
        const Icon = step.icon;
        const isDone = currentStep > i;
        const isActive = currentStep === i;
        const isFailed = failed && isActive;

        let bgClass = "bg-[#0b0e14]/50 border-white/5";
        let textClass = "text-slate-400";
        let iconColor = "text-slate-500";
        let glowClass = "";

        if (isDone) { 
          bgClass = "bg-emerald-950/30 border-emerald-900/50"; 
          textClass = "text-emerald-400"; 
          iconColor = "text-emerald-400"; 
        } else if (isActive && !failed) { 
          bgClass = "bg-violet-950/30 border-violet-500/30"; 
          textClass = "text-white"; 
          iconColor = step.color; 
          glowClass = "shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse"; 
        } else if (isFailed) { 
          bgClass = "bg-red-950/30 border-red-900/50"; 
          textClass = "text-red-400"; 
          iconColor = "text-red-400"; 
        }

        return (
          <div key={step.id} className="flex items-center shrink-0">
            <div className={`min-w-[120px] p-3 rounded-xl border flex flex-col items-center gap-2 transition-all duration-500 ${bgClass} ${glowClass}`}>
              {isDone ? <CheckCircle size={18} className="text-emerald-400" /> : 
               isFailed ? <XCircle size={18} className="text-red-400" /> : 
               <Icon size={18} className={iconColor} />}
              <span className={`text-[11px] font-semibold tracking-wider uppercase ${textClass}`}>
                {step.label}
              </span>
            </div>
            {i < IMPORT_STEPS.length - 1 && (
              <div className={`w-8 h-[2px] shrink-0 transition-colors duration-500 ${isDone ? 'bg-emerald-900/50' : 'bg-white/5'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProjectInfoCard({ info, owner, repo }) {
  if (!info) return null;
  const items = [
    { label: 'Framework', value: info.framework || 'unknown', icon: Box },
    { label: 'Test Runner', value: info.testFramework || 'unknown', icon: TestTube2 },
    { label: 'Entry', value: info.entryPoint || '—', icon: FileCode },
    { label: 'Source', value: `${info.srcFiles || 0} files`, icon: FolderTree },
    { label: 'Tests', value: `${info.testFiles || 0} files`, icon: CheckCircle },
  ];

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden mt-6 transition-all hover:bg-white/[0.07]">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <FolderTree size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Project Structure</span>
        </div>
        <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noopener noreferrer" 
           className="text-xs text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors">
          View on GitHub <ExternalLink size={12} />
        </a>
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Icon size={12} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{item.label}</span>
              </div>
              <div className="text-sm text-slate-200 font-mono">{item.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FailuresTable({ failures, onRepair, repairingId, repairs }) {
  if (!failures || failures.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl mt-6">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3 bg-black/20">
          <CheckCircle size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white">Test Results</span>
        </div>
        <div className="p-10 flex flex-col items-center justify-center text-slate-400 text-sm">
          <CheckCircle size={40} className="text-emerald-400/50 mb-3" />
          <p>All tests passed successfully.</p>
        </div>
      </div>
    );
  }

  const repairStatus = {};
  for (const r of (repairs || [])) {
    repairStatus[r.failureId] = r.status;
  }

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl mt-6 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <AlertCircle size={16} className="text-red-400" />
          <span className="text-sm font-semibold text-white">Detected Failures ({failures.length})</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-black/20 border-b border-white/10">
            <tr>
              <th className="px-5 py-3 font-semibold">Failure ID</th>
              <th className="px-5 py-3 font-semibold">Test / Error</th>
              <th className="px-5 py-3 font-semibold">Suspect Files</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {failures.map(f => {
              const isRepairing = repairingId === f.failureId;
              const rStatus = repairStatus[f.failureId];
              return (
                <tr key={f.failureId} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      {f.failureId}
                    </span>
                  </td>
                  <td className="px-5 py-4 max-w-[300px]">
                    <div className="truncate text-xs text-slate-300 mb-1">{f.describeBlock || f.testFile}</div>
                    <div className="truncate text-sm font-medium text-white mb-1">{f.testName}</div>
                    <div className="truncate text-xs text-red-400 font-mono">{f.error?.message?.split('\n')[0]}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-xs text-slate-400 font-mono">
                      {(f.fileSuspects || []).map(s => s.file?.split('/').pop()).filter(Boolean).join(', ') || '—'}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {rStatus === 'FIX_VERIFIED' && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">VERIFIED</span>}
                    {rStatus === 'REPAIR_FAILED' && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">FAILED</span>}
                    {!rStatus && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING</span>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onRepair(f.failureId)}
                      disabled={isRepairing || rStatus === 'FIX_VERIFIED'}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isRepairing 
                          ? 'bg-violet-500/20 text-violet-300 cursor-wait' 
                          : rStatus === 'FIX_VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-500/50 cursor-not-allowed'
                            : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md hover:shadow-violet-500/25'
                      }`}
                    >
                      {isRepairing
                        ? <><RotateCcw size={14} className="animate-spin" /> Repairing...</>
                        : rStatus === 'FIX_VERIFIED'
                          ? <><CheckCircle size={14} /> Fixed</>
                          : <><Zap size={14} /> AI Repair</>
                      }
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportHistoryTable({ imports, onSelect, onDelete, selectedId }) {
  if (!imports || imports.length === 0) return null;

  const statusBadge = (status) => {
    switch (status) {
      case 'READY':     return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">READY</span>;
      case 'FAILED':    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">FAILED</span>;
      case 'CLEANED':   return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">CLEANED</span>;
      case 'REPAIRING': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">REPAIRING</span>;
      default:          return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">{status}</span>;
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl mt-8 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Import History ({imports.length})</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-black/20 border-b border-white/10">
            <tr>
              <th className="px-5 py-3 font-semibold">Repository</th>
              <th className="px-5 py-3 font-semibold">Framework</th>
              <th className="px-5 py-3 font-semibold">Failures</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {imports.map(imp => (
              <tr
                key={imp._id}
                onClick={() => imp.status === 'READY' && onSelect(imp)}
                className={`transition-colors group ${imp.status === 'READY' ? 'cursor-pointer hover:bg-white/[0.04]' : ''} ${selectedId === imp._id ? 'bg-violet-500/10' : ''}`}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <GitFork size={14} className="text-slate-400" />
                    <span className="font-mono text-xs text-slate-200">{imp.owner}/{imp.repo}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs text-slate-400">{imp.projectInfo?.framework || '—'}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-semibold ${(imp.failures?.length || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {imp.failures?.length || 0}
                  </span>
                </td>
                <td className="px-5 py-3.5">{statusBadge(imp.status)}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs text-slate-500">{new Date(imp.createdAt).toLocaleDateString()}</span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {imp.status === 'READY' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelect(imp); }}
                        className="px-2.5 py-1 rounded text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 transition-colors border border-white/5"
                      >
                        View
                      </button>
                    )}
                    {(imp.status === 'READY' || imp.status === 'FAILED') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(imp._id); }}
                        className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GitHubImport() {
  const [repoUrl, setRepoUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState(-1);
  const [importFailed, setImportFailed] = useState(false);
  const [importError, setImportError] = useState('');
  const [currentImport, setCurrentImport] = useState(null);
  const [imports, setImports] = useState([]);
  const [repairingId, setRepairingId] = useState(null);
  const [repairResults, setRepairResults] = useState([]);
  const [validationInfo, setValidationInfo] = useState(null);
  const [validating, setValidating] = useState(false);
  const urlInputRef = useRef(null);

  useEffect(() => { fetchImports(); }, []);

  const fetchImports = async () => {
    try {
      const res = await axios.get('/api/github/imports');
      setImports(res.data.imports || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!repoUrl.trim()) { setValidationInfo(null); return; }
    const timer = setTimeout(async () => {
      const pattern = /^(?:https?:\/\/)?github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;
      if (!pattern.test(repoUrl.trim())) {
        setValidationInfo({ valid: false, error: 'Invalid GitHub URL format' });
        return;
      }
      setValidating(true);
      try {
        const res = await axios.post('/api/github/validate', { repoUrl });
        setValidationInfo(res.data);
      } catch (err) {
        setValidationInfo({ valid: false, error: err.response?.data?.error || err.message });
      } finally {
        setValidating(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [repoUrl]);

  const handleImport = async () => {
    if (!repoUrl.trim() || importing) return;
    setImporting(true);
    setImportFailed(false);
    setImportError('');
    setCurrentImport(null);
    setRepairResults([]);
    setImportStep(0);
    
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    try {
      const apiCall = axios.post('/api/github/import', { repoUrl });
      await delay(1200); setImportStep(1);
      await delay(2000); setImportStep(2);
      await delay(1500); setImportStep(3);
      await delay(2500); setImportStep(4);
      const res = await apiCall;
      const importDoc = res.data.import;

      if (importDoc.status === 'FAILED') {
        setImportFailed(true);
        setImportError(importDoc.error || 'Import failed');
        setImportStep(STATUS_TO_STEP[importDoc.status] ?? 4);
      } else {
        setImportStep(5);
        setCurrentImport(importDoc);
      }
      fetchImports();
    } catch (err) {
      setImportFailed(true);
      setImportError(err.response?.data?.error || err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleRepair = async (failureId) => {
    if (!currentImport || repairingId) return;
    setRepairingId(failureId);
    try {
      const res = await axios.post(`/api/github/imports/${currentImport._id}/repair`, { failureId });
      setRepairResults(prev => [...prev, res.data.result]);
      const updated = await axios.get(`/api/github/imports/${currentImport._id}`);
      setCurrentImport(updated.data.import);
    } catch (err) {
      setRepairResults(prev => [...prev, {
        failureId, status: 'REPAIR_FAILED', error: err.response?.data?.error || err.message,
      }]);
    } finally {
      setRepairingId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/github/imports/${id}`);
      if (currentImport?._id === id) setCurrentImport(null);
      fetchImports();
    } catch { /* ignore */ }
  };

  const handleSelectImport = async (imp) => {
    try {
      const res = await axios.get(`/api/github/imports/${imp._id}`);
      setCurrentImport(res.data.import);
      setRepairResults(res.data.import.repairs || []);
      setImportStep(5);
      setImportFailed(false);
      setImportError('');
    } catch { /* ignore */ }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-900 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/20 ring-1 ring-white/10">
            <GitFork size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">GitHub Import</h1>
            <p className="text-sm text-slate-400 mt-1">
              Import a public GitHub repository for automated failure detection and AI repair
            </p>
          </div>
        </div>
      </div>

      {/* URL Input Card */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-6 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Search size={16} className="text-violet-400" />
          Analyze Repository
        </h2>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <GitFork size={18} className="text-slate-500 group-focus-within:text-violet-400 transition-colors" />
            </div>
            <input
              ref={urlInputRef}
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleImport()}
              placeholder="https://github.com/owner/repository"
              disabled={importing}
              className={`block w-full pl-10 pr-10 py-3 bg-black/40 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-mono shadow-inner ${
                validationInfo 
                  ? validationInfo.valid ? 'border-emerald-500/30 focus:border-emerald-500' : 'border-red-500/50 focus:border-red-500' 
                  : 'border-white/10 focus:border-violet-500/50'
              }`}
            />
            {validating && (
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                <Loader size={16} className="text-violet-400 animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={handleImport}
            disabled={importing || !repoUrl.trim() || (validationInfo && !validationInfo.valid)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:hover:bg-violet-600 text-white font-medium rounded-lg shadow-lg shadow-violet-900/20 transition-all active:scale-[0.98]"
          >
            {importing ? (
              <><RotateCcw size={18} className="animate-spin" /> Processing...</>
            ) : (
              <><Download size={18} /> Import & Analyze</>
            )}
          </button>
        </div>

        {/* Validation feedback */}
        {validationInfo && !importing && (
          <div className={`mt-4 px-4 py-3 rounded-lg border flex items-center gap-3 text-sm animate-in slide-in-from-top-2 ${
            validationInfo.valid ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-200' : 'bg-red-950/30 border-red-900/50 text-red-200'
          }`}>
            {validationInfo.valid ? (
              <>
                <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                <span className="font-semibold">{validationInfo.owner}/{validationInfo.repo}</span>
                {validationInfo.description && (
                  <span className="text-emerald-200/70 truncate hidden md:inline">
                    — {validationInfo.description}
                  </span>
                )}
                {validationInfo.stars > 0 && (
                  <span className="ml-auto text-amber-400 text-xs font-semibold shrink-0 flex items-center gap-1">
                    ★ {validationInfo.stars.toLocaleString()}
                  </span>
                )}
                <span className="ml-3 px-2 py-0.5 rounded bg-black/30 border border-emerald-900/50 text-[10px] font-mono shrink-0">
                  {validationInfo.language}
                </span>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-red-400 shrink-0" />
                <span>{validationInfo.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Import Pipeline Progress */}
      {importStep >= 0 && (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-6 shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap size={16} className="text-violet-400" />
              Pipeline Status
            </h2>
            {importing && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">RUNNING</span>}
          </div>
          
          <PipelineProgress currentStep={importStep} failed={importFailed} />

          {/* Messages */}
          {importFailed && importError && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-red-950/30 border border-red-900/50 flex items-start gap-3 text-sm font-medium text-red-300 animate-in fade-in">
              <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>{importError}</div>
            </div>
          )}
          
          {currentImport && currentImport.status === 'READY' && importStep >= 5 && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-emerald-950/30 border border-emerald-900/50 flex items-center gap-3 text-sm font-medium text-emerald-400 animate-in fade-in">
              <CheckCircle size={18} className="shrink-0" />
              Repository imported successfully. Found {currentImport.failures?.length || 0} failures.
            </div>
          )}
        </div>
      )}

      {/* Project Info + Failures */}
      {currentImport && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          <ProjectInfoCard
            info={currentImport.projectInfo}
            owner={currentImport.owner}
            repo={currentImport.repo}
          />
          <FailuresTable
            failures={currentImport.failures}
            onRepair={handleRepair}
            repairingId={repairingId}
            repairs={repairResults}
          />
        </div>
      )}

      {/* Repair Results */}
      {repairResults.length > 0 && (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl mt-6 overflow-hidden animate-in fade-in">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3 bg-black/20">
            <Zap size={16} className="text-cyan-400" />
            <span className="text-sm font-semibold text-white">Repair Results ({repairResults.length})</span>
          </div>
          <div className="divide-y divide-white/5">
            {repairResults.map((r, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3 text-sm hover:bg-white/[0.02] transition-colors">
                {r.status === 'FIX_VERIFIED' ? <CheckCircle size={16} className="text-emerald-400 shrink-0" /> : <XCircle size={16} className="text-red-400 shrink-0" />}
                <span className="font-mono text-xs text-slate-400 bg-black/30 px-2 py-0.5 rounded border border-white/5 shrink-0">
                  {r.failureId}
                </span>
                <span className={`font-semibold shrink-0 ${r.status === 'FIX_VERIFIED' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.status === 'FIX_VERIFIED' ? 'FIX VERIFIED' : 'REPAIR FAILED'}
                </span>
                {r.rootCause && (
                  <span className="text-slate-400 truncate text-xs ml-2 border-l border-white/10 pl-3 hidden md:block">
                    {r.rootCause}
                  </span>
                )}
                {r.attempts && (
                  <span className="ml-auto text-xs text-slate-500 font-medium shrink-0">
                    {r.attempts.length} attempt{r.attempts.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ImportHistoryTable
        imports={imports}
        onSelect={handleSelectImport}
        onDelete={handleDelete}
        selectedId={currentImport?._id}
      />
    </div>
  );
}

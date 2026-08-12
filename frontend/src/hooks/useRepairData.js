import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export function useRepairData() {
  const [failures, setFailures] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, hRes] = await Promise.all([
        axios.get('/api/repairs/failures'),
        axios.get('/api/repairs/history'),
      ]);
      setFailures(fRes.data.failures || []);
      setHistory(hRes.data.history || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const stats = {
    apisMonitored: 6,
    activeFailures: failures.length,
    issuesRepaired: history.filter(h => h.status === 'FIX_VERIFIED').length,
    successRate: history.length > 0
      ? Math.round((history.filter(h => h.status === 'FIX_VERIFIED').length / history.length) * 100)
      : 0,
  };

  // Derive API health rows from failures + known endpoints
  const KNOWN_ENDPOINTS = [
    { method: 'POST', path: '/api/products', describeKey: 'POST /api/products' },
    { method: 'GET',  path: '/api/products', describeKey: 'GET /api/products' },
    { method: 'GET',  path: '/api/products/:id', describeKey: 'GET /api/products/:id' },
    { method: 'POST', path: '/api/users', describeKey: 'POST /api/users' },
    { method: 'DELETE', path: '/api/users/:id', describeKey: 'DELETE /api/users/:id' },
    { method: 'GET', path: '/api/users', describeKey: 'GET /api/users' },
  ];

  const apiHealth = KNOWN_ENDPOINTS.map(ep => {
    const relatedFailures = failures.filter(f =>
      f.describeBlock && f.describeBlock.includes(ep.describeKey)
    );
    const repaired = history.find(h =>
      h.testName && h.testName.includes(ep.path.replace('/:id', '')) && h.status === 'FIX_VERIFIED'
    );
    return {
      ...ep,
      status: relatedFailures.length > 0 ? 'failing' : 'healthy',
      failures: relatedFailures,
      repaired: !!repaired,
      errorMsg: relatedFailures[0]?.error?.message?.split('\n')[0] || null,
      aiStatus: repaired ? 'FIX_VERIFIED' : relatedFailures.length > 0 ? 'PENDING' : 'OK',
    };
  });

  return { failures, history, loading, error, stats, apiHealth, refetch: fetchAll };
}

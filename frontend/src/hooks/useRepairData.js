import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export function useRepairData() {
  const [failures, setFailures] = useState([]);
  const [history, setHistory] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, hRes, eRes] = await Promise.all([
        axios.get('/api/repairs/failures'),
        axios.get('/api/repairs/history'),
        axios.get('/api/settings/endpoints').catch(() => ({ data: { endpoints: [] } }))
      ]);
      setFailures(fRes.data.failures || []);
      setHistory(hRes.data.history || []);
      setEndpoints(eRes.data.endpoints || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const stats = {
    apisMonitored: endpoints.length || 0,
    activeFailures: failures.length,
    issuesRepaired: history.filter(h => h.status === 'FIX_VERIFIED').length,
    successRate: history.length > 0
      ? Math.round((history.filter(h => h.status === 'FIX_VERIFIED').length / history.length) * 100)
      : 0,
  };

  const apiHealth = endpoints.map(ep => {
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

  return { failures, history, loading, error, stats, apiHealth, endpoints, refetch: fetchAll };
}

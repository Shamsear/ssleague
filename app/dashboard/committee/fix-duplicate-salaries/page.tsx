'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function FixDuplicateSalariesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && (user.role === 'committee_admin' || user.role === 'super_admin')) {
      loadDuplicates();
    }
  }, [user]);

  const loadDuplicates = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithTokenRefresh('/api/admin/fix-duplicate-salaries');
      if (response.ok) {
        const data = await response.json();
        setDuplicates(data.duplicates || []);
      } else {
        alert('Failed to load duplicates');
      }
    } catch (error) {
      console.error('Error loading duplicates:', error);
      alert('Error loading duplicates');
    } finally {
      setIsLoading(false);
    }
  };

  const reverseDuplicate = async (duplicateId: string) => {
    if (!confirm('Are you sure you want to DELETE this duplicate transaction and recalculate the team budget?')) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetchWithTokenRefresh('/api/admin/fix-duplicate-salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reverse',
          duplicateId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Duplicate deleted:', data);
        alert(`✅ Duplicate deleted successfully!\n\nNew real_player_budget: ${data.new_balance.realTotal}`);
        setProcessedIds(prev => new Set(prev).add(duplicateId));
        await loadDuplicates();
      } else {
        const error = await response.json();
        console.error('❌ Delete failed:', error);
        alert(`Failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error reversing duplicate:', error);
      alert('Error reversing duplicate');
    } finally {
      setIsProcessing(false);
    }
  };

  const reverseAll = async () => {
    if (!confirm(`Are you sure you want to DELETE ALL ${duplicates.length} duplicate transactions and recalculate team budgets?\n\nThis will permanently remove the duplicate salary payments.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetchWithTokenRefresh('/api/admin/fix-duplicate-salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reverse_all',
          duplicates
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Bulk delete complete:', data);
        
        const summary = data.updated_teams.map((t: any) => 
          `${t.team_season_id}: ${t.new_balance.realTotal} Real Player Budget`
        ).join('\n');
        
        alert(`✅ ${data.message}\n\nUpdated balances:\n${summary}`);
        await loadDuplicates();
      } else {
        const error = await response.json();
        console.error('❌ Bulk delete failed:', error);
        alert(`Failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error reversing all:', error);
      alert('Error reversing all duplicates');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'committee_admin' && user.role !== 'super_admin')) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Fix Duplicate Salary Deductions</h1>
          <p className="text-gray-600 mt-2">
            This tool finds and reverses duplicate match reward transactions
          </p>
        </div>

        {duplicates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Duplicates Found!</h2>
            <p className="text-gray-600">All salary transactions are clean.</p>
            <button
              onClick={loadDuplicates}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        ) : (
          <>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-bold text-yellow-900">⚠️ Found {duplicates.length} Duplicate Transaction(s)</h3>
                  <p className="text-sm text-yellow-800 mt-1">
                    These transactions were created within 5 minutes of each other and appear to be duplicates.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4 flex justify-between items-center">
              <button
                onClick={loadDuplicates}
                disabled={isProcessing}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                🔄 Refresh
              </button>
              <button
                onClick={reverseAll}
                disabled={isProcessing}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : `🗑️ Delete All ${duplicates.length} Duplicates & Fix Budgets`}
              </button>
            </div>

            <div className="space-y-4">
              {duplicates.map((dup, idx) => (
                <div key={idx} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Duplicate #{idx + 1}</h3>
                      <p className="text-sm text-gray-600">Team ID: {dup.duplicate.team_id}</p>
                    </div>
                    <button
                      onClick={() => reverseDuplicate(dup.duplicate.id)}
                      disabled={isProcessing || processedIds.has(dup.duplicate.id)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processedIds.has(dup.duplicate.id) ? '✅ Deleted' : '🗑️ Delete This'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-xs text-gray-600 mb-1">Original Transaction</p>
                      <p className="text-sm font-mono text-gray-800">{new Date(dup.original.created_at).toLocaleString()}</p>
                    </div>
                    <div className="bg-red-50 rounded p-3">
                      <p className="text-xs text-red-600 mb-1">Duplicate Transaction</p>
                      <p className="text-sm font-mono text-gray-800">{new Date(dup.duplicate.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded p-4 mb-3">
                    <p className="text-sm font-semibold text-gray-900 mb-2">Description:</p>
                    <p className="text-sm text-gray-700">{dup.duplicate.description}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded p-3 text-center">
                      <p className="text-xs text-gray-600">eCoin Amount</p>
                      <p className="text-lg font-bold text-green-600">
                        {dup.duplicate.amount_football ?? dup.duplicate.amount ?? 0}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded p-3 text-center">
                      <p className="text-xs text-gray-600">SSCoin Amount</p>
                      <p className="text-lg font-bold text-purple-600">
                        {dup.duplicate.amount_real ?? 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded p-3 text-center">
                      <p className="text-xs text-gray-600">Time Apart</p>
                      <p className="text-lg font-bold text-gray-900">
                        {dup.timeDiff >= 60 ? `${Math.round(dup.timeDiff / 60)}h ${dup.timeDiff % 60}m` : `${dup.timeDiff}m`}
                      </p>
                      {dup.sameDay && <p className="text-xs text-orange-600 mt-1">Same Day</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

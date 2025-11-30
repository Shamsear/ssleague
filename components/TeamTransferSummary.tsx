'use client';

import { useEffect, useState } from 'react';
import { ArrowRightLeft, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface TransferSummaryData {
  transfersUsed: number;
  transfersRemaining: number;
  canTransfer: boolean;
  transactions: {
    id: string;
    transaction_type: 'transfer' | 'swap' | 'release';
    created_at: string;
    player_name?: string;
    player_a_name?: string;
    player_b_name?: string;
    committee_fee?: number;
    total_committee_fees?: number;
    refund_amount?: number;
    old_team_id?: string;
    new_team_id?: string;
    team_a_id?: string;
    team_b_id?: string;
  }[];
  totalFeesPaid: number;
  netFinancialImpact: number;
  breakdown: {
    transfers: number;
    swaps: number;
    releases: number;
  };
}

interface TeamTransferSummaryProps {
  teamId: string;
  seasonId: string;
  className?: string;
}

export default function TeamTransferSummary({ teamId, seasonId, className = '' }: TeamTransferSummaryProps) {
  const [data, setData] = useState<TransferSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTransferSummary();
  }, [teamId, seasonId]);

  const loadTransferSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch transfer limit status
      const limitRes = await fetchWithTokenRefresh(
        `/api/players/transfer-limits?team_id=${teamId}&season_id=${seasonId}`
      );
      
      if (!limitRes.ok) {
        throw new Error('Failed to fetch transfer limits');
      }
      
      const limitData = await limitRes.json();

      // Fetch transaction history for this team
      const historyRes = await fetchWithTokenRefresh(
        `/api/players/transfer-history?season_id=${seasonId}&team_id=${teamId}`
      );
      
      if (!historyRes.ok) {
        throw new Error('Failed to fetch transaction history');
      }
      
      const historyData = await historyRes.json();

      // Calculate summary data
      const transactions = historyData.transactions || [];
      let totalFeesPaid = 0;
      let netFinancialImpact = 0;
      const breakdown = {
        transfers: 0,
        swaps: 0,
        releases: 0
      };

      transactions.forEach((tx: any) => {
        // Check if this team is involved in the transaction
        let teamInvolved = false;

        // Calculate fees paid and check involvement
        if (tx.transaction_type === 'transfer') {
          // Team paid fee if they were the buying team
          if (tx.new_team_id === teamId) {
            teamInvolved = true;
            if (tx.financial?.committee_fee) {
              totalFeesPaid += tx.financial.committee_fee;
              netFinancialImpact -= tx.financial.buying_team_paid || 0;
            }
          }
          // Team received compensation if they were the selling team
          if (tx.old_team_id === teamId) {
            teamInvolved = true;
            if (tx.financial?.selling_team_received) {
              netFinancialImpact += tx.financial.selling_team_received;
            }
          }
        } else if (tx.transaction_type === 'swap') {
          // Calculate which fee this team paid
          if (tx.teams?.team_a_id === teamId || tx.team_a_id === teamId) {
            teamInvolved = true;
            totalFeesPaid += tx.financial?.team_a_fee || 0;
            netFinancialImpact -= tx.teams?.team_a_pays || 0;
          } else if (tx.teams?.team_b_id === teamId || tx.team_b_id === teamId) {
            teamInvolved = true;
            totalFeesPaid += tx.financial?.team_b_fee || 0;
            netFinancialImpact -= tx.teams?.team_b_pays || 0;
          }
        } else if (tx.transaction_type === 'release') {
          // Team received refund
          if (tx.old_team_id === teamId) {
            teamInvolved = true;
            if (tx.financial?.refund_amount) {
              netFinancialImpact += tx.financial.refund_amount;
            }
          }
        }

        // Only count in breakdown if team is involved
        if (teamInvolved && tx.transaction_type in breakdown) {
          breakdown[tx.transaction_type as keyof typeof breakdown]++;
        }
      });

      // Calculate transfersRemaining if not provided or if it's incorrect
      const transfersUsed = limitData.transfersUsed || 0;
      const transfersRemaining = limitData.transfersRemaining !== undefined 
        ? limitData.transfersRemaining 
        : Math.max(0, 2 - transfersUsed);
      const canTransfer = transfersUsed < 2;

      setData({
        transfersUsed,
        transfersRemaining,
        canTransfer,
        transactions: transactions.map((tx: any) => ({
          id: tx.id,
          transaction_type: tx.transaction_type,
          created_at: tx.created_at,
          player_name: tx.player?.name,
          player_a_name: tx.player_a?.name,
          player_b_name: tx.player_b?.name,
          committee_fee: tx.financial?.committee_fee,
          total_committee_fees: tx.financial?.total_committee_fees,
          refund_amount: tx.financial?.refund_amount,
          old_team_id: tx.old_team_id,
          new_team_id: tx.new_team_id,
          team_a_id: tx.teams?.team_a_id,
          team_b_id: tx.teams?.team_b_id
        })),
        totalFeesPaid,
        netFinancialImpact,
        breakdown
      });
    } catch (err) {
      console.error('Error loading transfer summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transfer summary');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'transfer': return 'bg-blue-100 text-blue-700';
      case 'swap': return 'bg-purple-100 text-purple-700';
      case 'release': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className={`glass rounded-2xl border border-white/30 shadow-xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200 border-t-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading transfer summary...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass rounded-2xl border border-red-200 shadow-xl p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="font-semibold">Error loading transfer summary</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`glass rounded-2xl border border-white/30 shadow-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-4">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="w-6 h-6" />
          <div>
            <h3 className="text-xl font-bold">Transfer Summary</h3>
            <p className="text-sm text-purple-100">Season transfer activity</p>
          </div>
        </div>
      </div>

      {/* Transfer Limit Status */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600">Transfer Slots</p>
            <p className="text-3xl font-bold text-gray-900">
              {data.transfersUsed} <span className="text-lg text-gray-500">of 2</span>
            </p>
          </div>
          <div className={`px-4 py-2 rounded-xl font-bold ${
            data.transfersUsed >= 2 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {data.transfersUsed >= 2 ? 'Limit Reached' : `${data.transfersRemaining} Remaining`}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full transition-all ${data.transfersUsed >= 2 ? 'bg-red-500' : 'bg-purple-500'}`}
            style={{ width: `${(data.transfersUsed / 2) * 100}%` }}
          />
        </div>
      </div>

      {/* Financial Summary */}
      <div className="p-6 border-b border-gray-200">
        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-purple-600" />
          Financial Impact
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-xs text-red-600 font-semibold mb-1">Total Fees Paid</p>
            <p className="text-2xl font-bold text-red-700">{data.totalFeesPaid.toFixed(2)}</p>
          </div>
          <div className={`rounded-xl p-4 ${data.netFinancialImpact >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-xs font-semibold mb-1 ${data.netFinancialImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Net Impact
            </p>
            <p className={`text-2xl font-bold flex items-center gap-1 ${data.netFinancialImpact >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {data.netFinancialImpact >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {data.netFinancialImpact >= 0 ? '+' : ''}{data.netFinancialImpact.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Breakdown */}
      <div className="p-6 border-b border-gray-200">
        <h4 className="font-bold text-gray-900 mb-4">Transaction Breakdown</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-xl">
            <p className="text-2xl font-bold text-blue-700">{data.breakdown.transfers}</p>
            <p className="text-xs text-blue-600 font-semibold">Transfers</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-xl">
            <p className="text-2xl font-bold text-purple-700">{data.breakdown.swaps}</p>
            <p className="text-xs text-purple-600 font-semibold">Swaps</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <p className="text-2xl font-bold text-red-700">{data.breakdown.releases}</p>
            <p className="text-xs text-red-600 font-semibold">Releases</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="p-6">
        <h4 className="font-bold text-gray-900 mb-4">Recent Transactions</h4>
        {data.transactions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {data.transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getTypeColor(tx.transaction_type)}`}>
                      {tx.transaction_type.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(tx.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {tx.transaction_type === 'transfer' && tx.player_name}
                    {tx.transaction_type === 'swap' && `${tx.player_a_name} ↔ ${tx.player_b_name}`}
                    {tx.transaction_type === 'release' && tx.player_name}
                  </p>
                  {tx.transaction_type === 'transfer' && (
                    <p className="text-xs text-gray-600">
                      {tx.old_team_id === teamId ? `Sold to ${tx.new_team_id}` : `Bought from ${tx.old_team_id}`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {tx.committee_fee && (
                    <p className="text-sm font-bold text-red-600">-{tx.committee_fee.toFixed(2)}</p>
                  )}
                  {tx.total_committee_fees && (
                    <p className="text-sm font-bold text-red-600">-{tx.total_committee_fees.toFixed(2)}</p>
                  )}
                  {tx.refund_amount && (
                    <p className="text-sm font-bold text-green-600">+{tx.refund_amount.toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))}
            {data.transactions.length > 5 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                Showing 5 of {data.transactions.length} transactions
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

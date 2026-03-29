'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { ArrowLeft, Clock, DollarSign, AlertCircle, CheckCircle, X, Check, TrendingUp } from 'lucide-react';

interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  real_team_name: string;
  purchase_price: number;
}

interface Trade {
  trade_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_name: string;
  team_b_name: string;
  trade_type: 'sale' | 'swap';
  team_a_players: string[];
  team_b_players: string[];
  team_a_cash: number;
  team_b_cash: number;
  status: string;
  proposed_at: string;
  expires_at: string;
}

export default function IncomingTradesPage() {
  const router = useRouter();
  
  // State
  const [teamId, setTeamId] = useState<string>('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [allPlayers, setAllPlayers] = useState<Map<string, Player>>(new Map());
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'accept' | 'reject'>('accept');
  const [responseMessage, setResponseMessage] = useState<string>('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const storedTeamId = localStorage.getItem('fantasy_team_id');
      if (!storedTeamId) {
        setError('Team information not found');
        return;
      }

      setTeamId(storedTeamId);

      // Fetch incoming trades
      const res = await fetchWithTokenRefresh(`/api/fantasy/trades/incoming?team_id=${storedTeamId}`);
      if (!res.ok) throw new Error('Failed to fetch trades');
      const data = await res.json();
      setTrades(data.trades || []);

      // Fetch all player details
      const playerIds = new Set<string>();
      data.trades?.forEach((trade: Trade) => {
        trade.team_a_players.forEach((id: string) => playerIds.add(id));
        trade.team_b_players.forEach((id: string) => playerIds.add(id));
      });

      // Load player details (simplified - in production, batch fetch)
      const playersMap = new Map<string, Player>();
      // For now, we'll just store IDs and fetch details when needed
      setAllPlayers(playersMap);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (action: 'accept' | 'reject') => {
    if (!selectedTrade) return;

    try {
      setResponding(selectedTrade.trade_id);
      setError('');

      const res = await fetchWithTokenRefresh('/api/fantasy/trades/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_id: selectedTrade.trade_id,
          team_id: teamId,
          action,
          response_message: responseMessage || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} trade`);
      }

      // Refresh trades list
      await loadData();
      setShowConfirmModal(false);
      setSelectedTrade(null);
      setResponseMessage('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResponding(null);
    }
  };

  const openConfirmModal = (trade: Trade, action: 'accept' | 'reject') => {
    setSelectedTrade(trade);
    setConfirmAction(action);
    setShowConfirmModal(true);
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  if (loading && trades.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Incoming Trade Offers</h1>
          <p className="text-gray-600 mt-2">Review and respond to trade proposals</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Trades List */}
        {trades.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Incoming Trades</h3>
            <p className="text-gray-600">You don't have any pending trade offers at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trades.map(trade => (
              <div key={trade.trade_id} className="bg-white rounded-lg shadow-md p-6">
                {/* Trade Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Trade from {trade.team_a_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(trade.proposed_at).toLocaleDateString()} at{' '}
                      {new Date(trade.proposed_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center text-sm">
                    <Clock className="w-4 h-4 text-gray-500 mr-1" />
                    <span className={`font-medium ${
                      getTimeRemaining(trade.expires_at) === 'Expired' 
                        ? 'text-red-600' 
                        : 'text-gray-700'
                    }`}>
                      {getTimeRemaining(trade.expires_at)}
                    </span>
                  </div>
                </div>

                {/* Trade Details */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* They Give */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">They Give:</h4>
                    <ul className="space-y-2">
                      {trade.team_a_players.map(playerId => (
                        <li key={playerId} className="text-sm text-blue-800">
                          • Player ID: {playerId}
                        </li>
                      ))}
                      {trade.team_a_cash > 0 && (
                        <li className="text-sm text-blue-800 font-medium">
                          • ${trade.team_a_cash} cash
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* You Give */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-3">You Give:</h4>
                    <ul className="space-y-2">
                      {trade.team_b_players.map(playerId => (
                        <li key={playerId} className="text-sm text-green-800">
                          • Player ID: {playerId}
                        </li>
                      ))}
                      {trade.team_b_cash > 0 && (
                        <li className="text-sm text-green-800 font-medium">
                          • ${trade.team_b_cash} cash
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Actions */}
                {trade.status === 'pending' && getTimeRemaining(trade.expires_at) !== 'Expired' && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => openConfirmModal(trade, 'reject')}
                      disabled={responding === trade.trade_id}
                      className="flex-1 py-3 px-6 border-2 border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Reject
                    </button>
                    <button
                      onClick={() => openConfirmModal(trade, 'accept')}
                      disabled={responding === trade.trade_id}
                      className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      {responding === trade.trade_id ? 'Processing...' : 'Accept'}
                    </button>
                  </div>
                )}

                {trade.status !== 'pending' && (
                  <div className={`text-center py-3 px-6 rounded-lg font-medium ${
                    trade.status === 'accepted' 
                      ? 'bg-green-100 text-green-800'
                      : trade.status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && selectedTrade && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {confirmAction === 'accept' ? 'Accept Trade?' : 'Reject Trade?'}
                </h2>
                
                <p className="text-gray-600 mb-4">
                  {confirmAction === 'accept' 
                    ? 'Are you sure you want to accept this trade? This action cannot be undone.'
                    : 'Are you sure you want to reject this trade?'}
                </p>

                {confirmAction === 'reject' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message (optional)
                    </label>
                    <textarea
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      placeholder="Let them know why..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setSelectedTrade(null);
                      setResponseMessage('');
                    }}
                    disabled={responding !== null}
                    className="flex-1 py-3 px-6 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRespond(confirmAction)}
                    disabled={responding !== null}
                    className={`flex-1 py-3 px-6 rounded-lg font-medium text-white disabled:bg-gray-400 disabled:cursor-not-allowed ${
                      confirmAction === 'accept'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {responding ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

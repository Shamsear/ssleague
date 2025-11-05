'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';

interface RegistrationStats {
  registration_phase: string;
  confirmed_slots_limit: number;
  confirmed_slots_filled: number;
  unconfirmed_registration_enabled: boolean;
  confirmed_registrations: number;
  unconfirmed_registrations: number;
  total_registrations: number;
}

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  registration_type: string;
  registration_date: string;
}

export default function RegistrationManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [stats, setStats] = useState<RegistrationStats | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<number>(50);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userSeasonId) return;

      try {
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);

        // Fetch registration stats
        const statsResponse = await fetch(`/api/admin/registration-phases?season_id=${userSeasonId}`);
        const statsResult = await statsResponse.json();
        
        if (statsResult.success) {
          setStats(statsResult.data);
          setNewLimit(statsResult.data.confirmed_slots_limit);
        }

        // Fetch registered players
        const playersResponse = await fetch(`/api/stats/players?seasonId=${userSeasonId}&limit=1000`);
        const playersResult = await playersResponse.json();
        
        if (playersResult.success && playersResult.data) {
          const registeredPlayers = playersResult.data
            .filter((p: any) => p.registration_type)
            .map((p: any) => ({
              id: p.id,
              player_id: p.player_id,
              player_name: p.player_name,
              registration_type: p.registration_type,
              registration_date: p.registration_date,
            }))
            .sort((a: Player, b: Player) => 
              new Date(a.registration_date).getTime() - new Date(b.registration_date).getTime()
            );
          
          setPlayers(registeredPlayers);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load registration data');
      } finally {
        setLoadingData(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  const handleAction = async (action: string, limit?: number) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/registration-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: userSeasonId,
          action,
          confirmed_slots_limit: limit,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        // Reload data
        window.location.reload();
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error('Error performing action:', error);
      setError('Failed to perform action');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">Loading registration management...</p>
        </div>
      </div>
    );
  }

  if (!isCommitteeAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            📋 Player Registration Management
          </h1>
          <p className="text-gray-600">
            Manage registration phases, confirmed slots, and view all registrations
          </p>
          {currentSeason && (
            <p className="text-sm text-gray-500 mt-1">Season: {currentSeason.name}</p>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {stats && (
          <>
            {/* Statistics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Confirmed Slots */}
              <div className="glass rounded-2xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                <h3 className="text-sm font-semibold text-green-900 mb-2">✅ Confirmed Slots</h3>
                <p className="text-4xl font-bold text-green-600 mb-1">
                  {stats.confirmed_registrations} / {stats.confirmed_slots_limit}
                </p>
                <p className="text-sm text-green-700">
                  {stats.confirmed_slots_limit - stats.confirmed_registrations} slots remaining
                </p>
              </div>

              {/* Unconfirmed Registrations */}
              <div className="glass rounded-2xl p-6 bg-gradient-to-br from-amber-50 to-yellow-50">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">⚠️ Unconfirmed Slots</h3>
                <p className="text-4xl font-bold text-amber-600 mb-1">
                  {stats.unconfirmed_registrations}
                </p>
                <p className="text-sm text-amber-700">Waitlist registrations</p>
              </div>

              {/* Total */}
              <div className="glass rounded-2xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">👥 Total Registrations</h3>
                <p className="text-4xl font-bold text-blue-600 mb-1">
                  {stats.total_registrations}
                </p>
                <p className="text-sm text-blue-700">All players registered</p>
              </div>
            </div>

            {/* Phase Management */}
            <div className="glass rounded-3xl p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Registration Phase Control</h2>
              
              {/* Current Phase */}
              <div className="mb-6 p-4 rounded-xl border-2 bg-gray-50">
                <p className="text-sm font-semibold text-gray-700 mb-2">Current Phase:</p>
                <div className="flex items-center gap-2">
                  {stats.registration_phase === 'confirmed' && (
                    <span className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold">
                      ✨ Phase 1: Confirmed Registration
                    </span>
                  )}
                  {stats.registration_phase === 'paused' && (
                    <span className="px-4 py-2 bg-gray-500 text-white rounded-lg font-bold">
                      ⏸️ Paused (Confirmed Slots Full)
                    </span>
                  )}
                  {stats.registration_phase === 'unconfirmed' && (
                    <span className="px-4 py-2 bg-amber-500 text-white rounded-lg font-bold">
                      ⚠️ Phase 2: Unconfirmed Registration
                    </span>
                  )}
                  {stats.registration_phase === 'closed' && (
                    <span className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold">
                      🔒 Closed
                    </span>
                  )}
                </div>
              </div>

              {/* Adjust Confirmed Slots */}
              <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-3">Set Confirmed Slots Limit</h3>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={newLimit}
                    onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)}
                    min="0"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleAction('set_confirmed_slots', newLimit)}
                    disabled={submitting}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    Update Limit
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  If you increase the limit, earliest unconfirmed registrations will be auto-promoted to confirmed
                </p>
              </div>

              {/* Phase Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => handleAction('enable_phase2')}
                  disabled={submitting || stats.registration_phase === 'unconfirmed'}
                  className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enable Phase 2
                </button>
                
                <button
                  onClick={() => handleAction('pause_registration')}
                  disabled={submitting || stats.registration_phase === 'paused'}
                  className="px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pause Registration
                </button>
                
                <button
                  onClick={() => handleAction('reopen_confirmed')}
                  disabled={submitting || stats.registration_phase === 'confirmed'}
                  className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reopen Phase 1
                </button>
                
                <button
                  onClick={() => handleAction('close_registration')}
                  disabled={submitting || stats.registration_phase === 'closed'}
                  className="px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Close Registration
                </button>
              </div>
            </div>

            {/* Registered Players List */}
            <div className="glass rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h2 className="text-2xl font-bold text-white">Registered Players ({players.length})</h2>
                <p className="text-blue-100 text-sm">Sorted by registration time (earliest first)</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Registration Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Registration Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {players.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <p className="font-medium text-gray-800">No registrations yet</p>
                        </td>
                      </tr>
                    ) : (
                      players.map((player, index) => (
                        <tr key={player.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{player.player_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">{player.player_id}</td>
                          <td className="px-4 py-3">
                            {player.registration_type === 'confirmed' ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✅ Confirmed
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                ⚠️ Unconfirmed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(player.registration_date).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

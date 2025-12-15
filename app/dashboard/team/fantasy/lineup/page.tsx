'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Player {
  id: string;
  real_player_id: string;
  player_name: string;
  position: string;
  is_starting: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export default function LineupPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [squad, setSquad] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStarters, setSelectedStarters] = useState<Set<string>>(new Set());
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [isLineupLocked, setIsLineupLocked] = useState(false);
  const [leagueId, setLeagueId] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchSquad();
    }
  }, [user, authLoading, router]);

  const fetchSquad = async () => {
    if (!user) return;
    
    try {
      const res = await fetch(`/api/fantasy/squad?user_id=${user.uid}`);
      if (!res.ok) throw new Error('Failed to fetch squad');
      const data = await res.json();
      
      setSquad(data.squad || []);
      setLeagueId(data.league_id || '');
      
      // Initialize selections from current data
      const starters = new Set<string>();
      data.squad?.forEach((p: Player) => {
        if (p.is_starting) starters.add(p.real_player_id);
        if (p.is_captain) setCaptainId(p.real_player_id);
        if (p.is_vice_captain) setViceCaptainId(p.real_player_id);
      });
      setSelectedStarters(starters);

      // Check lineup lock status
      if (data.league_id) {
        const lockRes = await fetch(`/api/admin/fantasy/lineup-lock?league_id=${data.league_id}`);
        if (lockRes.ok) {
          const lockData = await lockRes.json();
          setIsLineupLocked(lockData.is_lineup_locked || false);
        }
      }
    } catch (error) {
      console.error('Error fetching squad:', error);
      alert('Failed to load squad');
    } finally {
      setLoading(false);
    }
  };

  const toggleStarter = (playerId: string) => {
    const newStarters = new Set(selectedStarters);
    
    if (newStarters.has(playerId)) {
      // Removing from starters
      newStarters.delete(playerId);
      // Clear captain/VC if they were this player
      if (captainId === playerId) setCaptainId(null);
      if (viceCaptainId === playerId) setViceCaptainId(null);
    } else {
      // Adding to starters
      if (newStarters.size >= 5) {
        alert('You can only select 5 starting players');
        return;
      }
      newStarters.add(playerId);
    }
    
    setSelectedStarters(newStarters);
  };

  const handleSave = async () => {
    if (!user) return;
    
    // Validation
    if (selectedStarters.size !== 5) {
      alert('You must select exactly 5 starting players');
      return;
    }
    
    if (!captainId || !selectedStarters.has(captainId)) {
      alert('Please select a captain from your starting 5');
      return;
    }
    
    if (!viceCaptainId || !selectedStarters.has(viceCaptainId)) {
      alert('Please select a vice-captain from your starting 5');
      return;
    }
    
    if (captainId === viceCaptainId) {
      alert('Captain and vice-captain must be different players');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/fantasy/squad/set-lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          starting_player_ids: Array.from(selectedStarters),
          captain_player_id: captainId,
          vice_captain_player_id: viceCaptainId,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save lineup');
      }

      alert('Lineup saved successfully!');
      router.push('/dashboard/team/fantasy/my-team');
    } catch (error) {
      console.error('Error saving lineup:', error);
      alert(error instanceof Error ? error.message : 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600">Loading squad...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const starters = squad.filter(p => selectedStarters.has(p.real_player_id));
  const subs = squad.filter(p => !selectedStarters.has(p.real_player_id));

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Set Your Lineup</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            Select 5 starting players and choose your captain (2x points) and vice-captain (1.5x points)
          </p>
        </div>

        {/* Lineup Lock Warning */}
        {isLineupLocked && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-start gap-2 sm:gap-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-red-900 mb-1">🔒 Lineup Changes Locked</h3>
                <p className="text-xs sm:text-sm text-red-800">
                  The committee has locked lineup changes. You cannot modify your starting lineup, captain, or vice-captain at this time.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Starting 5 */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-green-600">
            Starting 5 ({starters.length}/5)
          </h2>
          
          {starters.length === 0 ? (
            <p className="text-sm sm:text-base text-gray-500 italic">No starters selected. Click players below to add them.</p>
          ) : (
            <div className="space-y-2">
              {starters.map(player => (
                <div
                  key={player.real_player_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 bg-green-50 border border-green-200 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm sm:text-base break-words">{player.player_name}</span>
                    <span className="text-xs sm:text-sm text-gray-600 ml-2">({player.position})</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <button
                      onClick={() => setCaptainId(player.real_player_id)}
                      disabled={isLineupLocked}
                      className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                        captainId === player.real_player_id
                          ? 'bg-yellow-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {captainId === player.real_player_id ? '⭐ C' : 'C'}
                    </button>
                    
                    <button
                      onClick={() => setViceCaptainId(player.real_player_id)}
                      disabled={isLineupLocked}
                      className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                        viceCaptainId === player.real_player_id
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {viceCaptainId === player.real_player_id ? '🥈 VC' : 'VC'}
                    </button>
                    
                    <button
                      onClick={() => toggleStarter(player.real_player_id)}
                      disabled={isLineupLocked}
                      className="px-2 sm:px-3 py-1 bg-red-500 text-white rounded text-xs sm:text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Substitutes */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-600">
            Substitutes ({subs.length})
          </h2>
          
          {subs.length === 0 ? (
            <p className="text-sm sm:text-base text-gray-500 italic">All players are in starting lineup</p>
          ) : (
            <div className="space-y-2">
              {subs.map(player => (
                <div
                  key={player.real_player_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm sm:text-base break-words">{player.player_name}</span>
                    <span className="text-xs sm:text-sm text-gray-600 ml-2">({player.position})</span>
                  </div>
                  
                  <button
                    onClick={() => toggleStarter(player.real_player_id)}
                    disabled={selectedStarters.size >= 5 || isLineupLocked}
                    className={`px-3 py-1.5 rounded text-xs sm:text-sm whitespace-nowrap ${
                      selectedStarters.size >= 5 || isLineupLocked
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    Add to Starting 5
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={handleSave}
            disabled={saving || selectedStarters.size !== 5 || !captainId || !viceCaptainId || isLineupLocked}
            className="flex-1 bg-blue-600 text-white py-3 px-4 sm:px-6 rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : isLineupLocked ? '🔒 Lineup Locked' : 'Save Lineup'}
          </button>
          
          <button
            onClick={() => router.push('/dashboard/team/fantasy/my-team')}
            className="px-4 sm:px-6 py-3 border border-gray-300 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

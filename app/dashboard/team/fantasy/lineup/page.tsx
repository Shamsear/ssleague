'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [squad, setSquad] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStarters, setSelectedStarters] = useState<Set<string>>(new Set());
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);

  useEffect(() => {
    fetchSquad();
  }, []);

  const fetchSquad = async () => {
    try {
      const res = await fetch('/api/fantasy/squad');
      if (!res.ok) throw new Error('Failed to fetch squad');
      const data = await res.json();
      
      setSquad(data.squad || []);
      
      // Initialize selections from current data
      const starters = new Set<string>();
      data.squad?.forEach((p: Player) => {
        if (p.is_starting) starters.add(p.id);
        if (p.is_captain) setCaptainId(p.id);
        if (p.is_vice_captain) setViceCaptainId(p.id);
      });
      setSelectedStarters(starters);
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
          starterIds: Array.from(selectedStarters),
          captainId,
          viceCaptainId,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center">Loading squad...</p>
        </div>
      </div>
    );
  }

  const starters = squad.filter(p => selectedStarters.has(p.id));
  const subs = squad.filter(p => !selectedStarters.has(p.id));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Set Your Lineup</h1>
          <p className="text-gray-600 mt-2">
            Select 5 starting players and choose your captain (2x points) and vice-captain (1.5x points)
          </p>
        </div>

        {/* Starting 5 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-green-600">
            Starting 5 ({starters.length}/5)
          </h2>
          
          {starters.length === 0 ? (
            <p className="text-gray-500 italic">No starters selected. Click players below to add them.</p>
          ) : (
            <div className="space-y-2">
              {starters.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded"
                >
                  <div className="flex-1">
                    <span className="font-semibold">{player.player_name}</span>
                    <span className="text-sm text-gray-600 ml-2">({player.position})</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCaptainId(player.id)}
                      className={`px-3 py-1 rounded text-sm ${
                        captainId === player.id
                          ? 'bg-yellow-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {captainId === player.id ? '⭐ Captain' : 'Captain'}
                    </button>
                    
                    <button
                      onClick={() => setViceCaptainId(player.id)}
                      className={`px-3 py-1 rounded text-sm ${
                        viceCaptainId === player.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {viceCaptainId === player.id ? '🥈 Vice' : 'Vice'}
                    </button>
                    
                    <button
                      onClick={() => toggleStarter(player.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
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
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-600">
            Substitutes ({subs.length})
          </h2>
          
          {subs.length === 0 ? (
            <p className="text-gray-500 italic">All players are in starting lineup</p>
          ) : (
            <div className="space-y-2">
              {subs.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded"
                >
                  <div>
                    <span className="font-semibold">{player.player_name}</span>
                    <span className="text-sm text-gray-600 ml-2">({player.position})</span>
                  </div>
                  
                  <button
                    onClick={() => toggleStarter(player.id)}
                    disabled={selectedStarters.size >= 5}
                    className={`px-3 py-1 rounded text-sm ${
                      selectedStarters.size >= 5
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
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving || selectedStarters.size !== 5 || !captainId || !viceCaptainId}
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Lineup'}
          </button>
          
          <button
            onClick={() => router.push('/dashboard/team/fantasy/my-team')}
            className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

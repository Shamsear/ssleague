'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Season {
  id: string;
  season_id: string;
  season_name: string;
  status: string;
}

export default function CreateFantasyLeaguePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingLeague, setExistingLeague] = useState<any>(null);

  const { alertState, showAlert, closeAlert } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      console.log('No user, redirecting to login');
      router.push('/login');
      return;
    }
    if (!loading && user) {
      console.log('User role:', user.role);
      if (user.role !== 'committee_admin' && user.role !== 'super_admin') {
        console.log('User role not authorized, redirecting to dashboard');
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadCurrentSeason = async () => {
      try {
        console.log('Loading current season for user:', user);
        
        // Check if user has season_id (use type assertion as seasonId may exist but not in type)
        const userSeasonId = (user as any)?.seasonId;
        
        // Check if fantasy league already exists for this season in PostgreSQL
        if (userSeasonId) {
          try {
            const response = await fetchWithTokenRefresh(`/api/fantasy/leagues/${userSeasonId}`);
            const data = await response.json();
            
            if (response.ok && data.success) {
              console.log('Existing league data:', data);
              setExistingLeague(data.league); // Extract the league object from the response
              setIsLoading(false);
              return;
            } else if (response.status === 404 && data.message && data.message.includes('tournament')) {
              // Season/tournament doesn't exist - show specific error
              console.log('Tournament not created for season:', userSeasonId);
              showAlert({
                type: 'error',
                title: 'Tournament Not Created',
                message: data.message || 'Please create the tournament/season first before creating a fantasy league.',
              });
              setIsLoading(false);
              return;
            } else {
              console.log('League API returned error:', data.error || 'Unknown error');
              console.log('Will attempt to load seasons and auto-create league');
            }
          } catch (error) {
            console.log('Error checking for existing league:', error);
          }
        }
        
        // Fetch seasons from PostgreSQL API
        const seasonsResponse = await fetchWithTokenRefresh(/api/seasons');
        if (!seasonsResponse.ok) {
          throw new Error('Failed to fetch seasons');
        }
        
        const seasonsData = await seasonsResponse.json();
        
        // Filter non-completed seasons
        const activeSeasonsData = seasonsData.filter((s: any) => s.status !== 'completed');
        
        if (activeSeasonsData.length === 0) {
          showAlert({
            type: 'error',
            title: 'No Active Season',
            message: 'No available seasons found. Please create a season first.',
          });
          setIsLoading(false);
          return;
        }

        const seasonsList = activeSeasonsData.map((s: any) => ({
          id: s.id,
          season_id: s.season_id,
          season_name: s.name || s.season_name,
          status: s.status,
        }));

        // If user has a season ID, try to find that specific season
        if (userSeasonId) {
          const userSeason = seasonsList.find((s: Season) => s.season_id === userSeasonId || s.id === userSeasonId);
          
          if (userSeason) {
            console.log('Loaded season:', userSeason);
            setSeasons([userSeason]);
            setSelectedSeasonId(userSeason.season_id || userSeason.id);
            setLeagueName(`${userSeason.season_name || 'Unnamed Season'} Fantasy League`);
            setIsLoading(false);
            return;
          }
        }

        // Otherwise, show all active seasons
        setSeasons(seasonsList);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading current season:', error);
        showAlert({
          type: 'error',
          title: 'Error',
          message: `Failed to load current season: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        setIsLoading(false);
      }
    };

    if (user) {
      loadCurrentSeason();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get the season ID - either from selectedSeasonId or from the single season
    const seasonIdToUse = selectedSeasonId || (seasons.length === 1 ? (seasons[0].season_id || seasons[0].id) : null);
    
    console.log('Form submitted with selectedSeasonId:', selectedSeasonId);
    console.log('Seasons array:', seasons);
    console.log('Season ID to use:', seasonIdToUse);

    if (!seasonIdToUse) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please select a season',
      });
      return;
    }

    if (!leagueName.trim()) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please enter a league name',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the league first by calling the API
      console.log('Creating fantasy league for season:', seasonIdToUse);
      
      const response = await fetchWithTokenRefresh(`/api/fantasy/leagues/${seasonIdToUse}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        // Use detailed message if available
        throw new Error(errorData.message || errorData.error || 'Failed to create fantasy league');
      }

      const data = await response.json();
      console.log('League created/fetched:', data.league);
      
      showAlert({
        type: 'success',
        title: 'Success!',
        message: 'Fantasy league is ready!',
      });
      
      // Navigate to league dashboard after successful creation
      setTimeout(() => {
        router.push(`/dashboard/committee/fantasy/${seasonIdToUse}`);
      }, 1000);
    } catch (error) {
      console.error('Error creating fantasy league:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create fantasy league',
      });
      setIsSubmitting(false);
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

  if (!user) return null;

  // If league already exists, show existing league card
  if (existingLeague) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <AlertModal {...alertState} onClose={closeAlert} />

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/dashboard/committee"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Fantasy League Already Exists</h1>
                <p className="text-gray-600 mt-1">Only one fantasy league per season is allowed</p>
              </div>
            </div>
          </div>

          {/* Existing League Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-green-900 mb-2">{existingLeague.name || existingLeague.league_name}</h2>
                  <div className="space-y-1 text-sm text-green-800">
                    <p>📅 <strong>Status:</strong> {existingLeague.status?.toUpperCase() || 'DRAFT'}</p>
                    <p>🏆 <strong>League ID:</strong> {existingLeague.league_id || existingLeague.id}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-900">
                  A fantasy league already exists for this season. Only one fantasy league can be created per season.
                  You can manage the existing league using the button below.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                href="/dashboard/committee"
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors text-center"
              >
                ← Back to Dashboard
              </Link>
              <Link
                href={`/dashboard/committee/fantasy/${existingLeague.league_id || existingLeague.season_id || existingLeague.id}`}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl text-center"
              >
                🏆 Manage League →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <AlertModal {...alertState} onClose={closeAlert} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Fantasy League</h1>
              <p className="text-gray-600 mt-1">Set up a new fantasy league for a season</p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Season Selection/Display */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {seasons.length === 1 ? 'Season (Current Admin Season)' : 'Select Season *'}
              </label>
              
              {seasons.length === 0 ? (
                // Loading state
                <div className="w-full px-4 py-3 border-2 border-gray-300 bg-gray-50 rounded-xl text-gray-500">
                  Loading season...
                </div>
              ) : seasons.length === 1 ? (
                // Auto-selected display for single season
                <>
                  <div className="w-full px-4 py-3 border-2 border-indigo-300 bg-indigo-50 rounded-xl text-gray-900 flex items-center justify-between">
                    <span className="font-medium">
                      {seasons[0]?.season_name || seasons[0]?.season_id || 'Unknown Season'}
                    </span>
                    <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                      AUTO-SELECTED
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-indigo-600">
                    ✓ Automatically set to your current active season
                  </p>
                </>
              ) : (
                // Dropdown for multiple seasons
                <>
                  <select
                    value={selectedSeasonId}
                    onChange={(e) => {
                      setSelectedSeasonId(e.target.value);
                      const selectedSeason = seasons.find(s => s.season_id === e.target.value);
                      if (selectedSeason) {
                        setLeagueName(`${selectedSeason.season_name} Fantasy League`);
                      }
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    required
                  >
                    <option value="">-- Select a Season --</option>
                    {seasons.map((season) => (
                      <option key={season.id} value={season.season_id}>
                        {season.season_name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-500">
                    Choose which season this fantasy league will run for
                  </p>
                </>
              )}
            </div>

            {/* League Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fantasy League Name *
              </label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="e.g., Season 16 Fantasy League"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                This name will be displayed to all participants
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-2">What happens when you create a fantasy league?</p>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>✅ Fantasy teams automatically created for all registered teams</li>
                    <li>✅ Default scoring rules configured (goals, MOTM, wins, etc.)</li>
                    <li>✅ League status set to "Draft" mode</li>
                    <li>✅ Ready for player draft assignment</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <Link
                href="/dashboard/committee"
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  '🏆 Create Fantasy League'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FixtureTimeline from '@/components/FixtureTimeline';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import PromptModal from '@/components/modals/PromptModal';

interface Matchup {
  id: number;
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  home_goals: number | null;
  away_goals: number | null;
  position: number;
}

interface Fixture {
  id: string;
  season_id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  status: string;
  leg: string;
  scheduled_date?: string;
  home_score?: number;
  away_score?: number;
  result?: string;
  motm_player_id?: string;
  motm_player_name?: string;
  match_status_reason?: string;
  created_at?: string;
  created_by_name?: string;
  result_submitted_at?: string;
  result_submitted_by_name?: string;
}

export default function CommitteeFixtureDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fixtureId = params?.fixtureId as string;

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedScores, setEditedScores] = useState<{[key: number]: {home: number, away: number}}>({});
  const [isSaving, setIsSaving] = useState(false);

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
    promptState,
    showPrompt,
    closePrompt,
    handlePromptConfirm,
  } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (fixtureId && user?.role === 'committee_admin') {
      fetchFixtureData();
    }
  }, [fixtureId, user]);

  const fetchFixtureData = async () => {
    setIsLoading(true);
    try {
      // Fetch fixture
      const fixtureRes = await fetch(`/api/fixtures/${fixtureId}`);
      const fixtureData = await fixtureRes.json();
      
      if (fixtureData.fixture) {
        setFixture(fixtureData.fixture);
      }

      // Fetch matchups
      const matchupsRes = await fetch(`/api/fixtures/${fixtureId}/matchups`);
      const matchupsData = await matchupsRes.json();
      
      if (matchupsData.matchups) {
        setMatchups(matchupsData.matchups);
        
        // Initialize edited scores
        const scores: {[key: number]: {home: number, away: number}} = {};
        matchupsData.matchups.forEach((m: Matchup) => {
          scores[m.position] = {
            home: m.home_goals ?? 0,
            away: m.away_goals ?? 0
          };
        });
        setEditedScores(scores);
      }
    } catch (error) {
      console.error('Error fetching fixture data:', error);
      showAlert({
        type: 'error',
        title: 'Load Failed',
        message: 'Failed to load fixture data'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclareWO = async (absentTeam: 'home' | 'away') => {
    const teamName = absentTeam === 'home' ? fixture?.home_team_name : fixture?.away_team_name;
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Declare Walkover',
      message: `Declare walkover due to ${teamName} being absent?`,
      confirmText: 'Declare WO',
      cancelText: 'Cancel'
    });
    
    if (!confirmed || !fixture) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/declare-wo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absent_team: absentTeam,
          declared_by: user?.uid,
          declared_by_name: user?.displayName || user?.email,
        })
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: 'Walkover Declared',
          message: 'Walkover declared successfully!'
        });
        fetchFixtureData();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Failed',
          message: error.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error declaring WO:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to declare walkover'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeclareNull = async () => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Declare Match NULL',
      message: 'Declare match NULL due to both teams being absent?',
      confirmText: 'Declare NULL',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/declare-null`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          declared_by: user?.uid,
          declared_by_name: user?.displayName || user?.email,
        })
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: 'Match Nullified',
          message: 'Match declared NULL successfully!'
        });
        fetchFixtureData();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Failed',
          message: error.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error declaring NULL:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to declare NULL'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveResults = async () => {
    if (!fixture) return;

    const reason = await showPrompt({
      title: 'Edit Reason',
      message: 'Enter reason for editing result (optional):',
      placeholder: 'Reason for edit...',
      defaultValue: ''
    });
    
    if (!reason) return; // User cancelled

    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Save Changes',
      message: 'Save the edited results? This will revert old stats and apply new ones.',
      confirmText: 'Save Changes',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;

    setIsSaving(true);
    try {
      // Prepare edited matchups
      const editedMatchups = matchups.map(m => ({
        position: m.position,
        home_player_id: m.home_player_id,
        home_player_name: m.home_player_name,
        away_player_id: m.away_player_id,
        away_player_name: m.away_player_name,
        home_goals: editedScores[m.position]?.home ?? m.home_goals ?? 0,
        away_goals: editedScores[m.position]?.away ?? m.away_goals ?? 0,
      }));

      const response = await fetch(`/api/fixtures/${fixtureId}/edit-result`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchups: editedMatchups,
          edited_by: user?.uid,
          edited_by_name: user?.displayName || user?.email,
          edit_reason: reason || 'Result corrected by committee admin'
        })
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: 'Results Updated',
          message: 'Results updated successfully! Stats have been recalculated.'
        });
        setIsEditMode(false);
        fetchFixtureData(); // Reload data
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Save Failed',
          message: error.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error saving results:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to save results. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fixture...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  if (!fixture) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Fixture Not Found</h1>
          <Link href="/dashboard/committee/team-management/tournament" className="text-blue-600 mt-4 inline-block">
            ← Back to Tournament
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/committee/team-management/tournament"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Tournament
        </Link>
        <h1 className="text-3xl font-bold gradient-text">Committee Fixture Management</h1>
        <p className="text-gray-600 mt-2">
          Round {fixture.round_number} • Match {fixture.match_number} • {fixture.leg === 'first' ? '1st Leg' : '2nd Leg'}
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Fixture Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Match Card */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-purple-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{fixture.home_team_name}</h2>
                <p className="text-sm text-gray-500">Home Team</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600">
                  {fixture.home_score ?? '-'} : {fixture.away_score ?? '-'}
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  fixture.status === 'completed' ? 'bg-green-100 text-green-700' :
                  fixture.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {fixture.status}
                </span>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-gray-900">{fixture.away_team_name}</h2>
                <p className="text-sm text-gray-500">Away Team</p>
              </div>
            </div>

            {fixture.match_status_reason && (
              <div className={`p-3 rounded-lg mb-4 ${
                fixture.match_status_reason.includes('wo') ? 'bg-orange-100 border-l-4 border-orange-500' :
                'bg-gray-100 border-l-4 border-gray-500'
              }`}>
                <p className="font-semibold text-sm">
                  {fixture.match_status_reason === 'wo_home_absent' && '⚠️ Walkover - Home team absent'}
                  {fixture.match_status_reason === 'wo_away_absent' && '⚠️ Walkover - Away team absent'}
                  {fixture.match_status_reason === 'null_both_absent' && '❌ Match NULL - Both teams absent'}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mt-4 pt-4 border-t">
              <div>
                <strong>Created:</strong> {fixture.created_at ? new Date(fixture.created_at).toLocaleString() : 'N/A'}
                {fixture.created_by_name && <span className="text-xs block">by {fixture.created_by_name}</span>}
              </div>
              {fixture.result_submitted_at && (
                <div>
                  <strong>Result Submitted:</strong> {new Date(fixture.result_submitted_at).toLocaleString()}
                  {fixture.result_submitted_by_name && <span className="text-xs block">by {fixture.result_submitted_by_name}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Matchups */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Individual Matchups</h3>
              {!isEditMode && fixture.status === 'completed' && (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  ✏️ Edit Results
                </button>
              )}
              {isEditMode && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditMode(false);
                      fetchFixtureData();
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveResults}
                    disabled={isSaving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {matchups.map((matchup) => (
                <div key={matchup.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{matchup.home_player_name}</p>
                    </div>
                    <div className="flex items-center gap-2 mx-4">
                      {isEditMode ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            value={editedScores[matchup.position]?.home ?? 0}
                            onChange={(e) => setEditedScores(prev => ({
                              ...prev,
                              [matchup.position]: { ...prev[matchup.position], home: parseInt(e.target.value) || 0 }
                            }))}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                          <span>-</span>
                          <input
                            type="number"
                            min="0"
                            value={editedScores[matchup.position]?.away ?? 0}
                            onChange={(e) => setEditedScores(prev => ({
                              ...prev,
                              [matchup.position]: { ...prev[matchup.position], away: parseInt(e.target.value) || 0 }
                            }))}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                        </>
                      ) : (
                        <span className="text-lg font-bold">
                          {matchup.home_goals ?? '-'} - {matchup.away_goals ?? '-'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-semibold">{matchup.away_player_name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Actions & Timeline */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold mb-4">Committee Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowTimeline(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium flex items-center justify-center"
              >
                📋 View Complete Timeline
              </button>

              {fixture.status !== 'completed' && (
                <>
                  <button
                    onClick={() => handleDeclareWO('home')}
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
                  >
                    ⚠️ WO - Home Team Absent
                  </button>
                  <button
                    onClick={() => handleDeclareWO('away')}
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
                  >
                    ⚠️ WO - Away Team Absent
                  </button>
                  <button
                    onClick={handleDeclareNull}
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 font-medium"
                  >
                    ❌ NULL - Both Teams Absent
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-lg p-6 border border-purple-200">
            <h3 className="font-bold text-purple-900 mb-3">Quick Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Season ID:</span>
                <span className="font-mono text-xs bg-white px-2 py-1 rounded">{fixture.season_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fixture ID:</span>
                <span className="font-mono text-xs bg-white px-2 py-1 rounded">{fixture.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Matchups:</span>
                <span className="font-semibold">{matchups.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Modal */}
      <FixtureTimeline
        fixtureId={fixtureId}
        isOpen={showTimeline}
        onClose={() => setShowTimeline(false)}
      />

      {/* Alert, Confirm, and Prompt Modals */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />

      <PromptModal
        isOpen={promptState.isOpen}
        onConfirm={handlePromptConfirm}
        onCancel={closePrompt}
        title={promptState.title}
        message={promptState.message}
        placeholder={promptState.placeholder}
        defaultValue={promptState.defaultValue}
        confirmText={promptState.confirmText}
        cancelText={promptState.cancelText}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Fixture {
  id: string;
  round_number: number;
  match_number: number;
  home_team_name: string;
  away_team_name: string;
  scheduled_date?: string;
  status: string;
}

interface LineupStatus {
  fixture: Fixture;
  hasLineup: boolean;
  isLocked: boolean;
  deadline?: string;
  isUserHomeTeam: boolean;
}

interface LineupStatusWidgetProps {
  teamId: string;
  seasonId: string;
}

export default function LineupStatusWidget({ teamId, seasonId }: LineupStatusWidgetProps) {
  const [upcomingFixtures, setUpcomingFixtures] = useState<LineupStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teamId && seasonId) {
      fetchLineupStatus();
    }
  }, [teamId, seasonId]);

  const fetchLineupStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch upcoming fixtures for the team
      const fixturesRes = await fetch(`/api/team/${teamId}/fixtures?season_id=${seasonId}&status=scheduled&limit=5`);
      const fixturesData = await fixturesRes.json();

      if (!fixturesData.success) {
        throw new Error('Failed to fetch fixtures');
      }

      // For each fixture, check if lineup exists
      const statusPromises = fixturesData.fixtures.map(async (fixture: Fixture) => {
        try {
          const lineupRes = await fetch(`/api/lineups?fixture_id=${fixture.id}&team_id=${teamId}`);
          const lineupData = await lineupRes.json();

          const hasLineup = lineupData.success && lineupData.lineups;
          const isLocked = hasLineup ? lineupData.lineups.is_locked : false;

          // Check deadline
          const editableRes = await fetch(`/api/fixtures/${fixture.id}/editable`);
          const editableData = await editableRes.json();

          return {
            fixture,
            hasLineup,
            isLocked,
            deadline: editableData.deadline,
            isUserHomeTeam: fixture.home_team_name === teamId
          };
        } catch (err) {
          console.error(`Error checking lineup for fixture ${fixture.id}:`, err);
          return {
            fixture,
            hasLineup: false,
            isLocked: false,
            isUserHomeTeam: false
          };
        }
      });

      const statuses = await Promise.all(statusPromises);
      setUpcomingFixtures(statuses);
    } catch (err: any) {
      console.error('Error fetching lineup status:', err);
      setError(err.message || 'Failed to load lineup status');
    } finally {
      setLoading(false);
    }
  };

  const getDeadlineStatus = (deadline?: string) => {
    if (!deadline) return null;

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const hoursRemaining = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining < 0) {
      return { label: 'Expired', color: 'red', urgent: true };
    } else if (hoursRemaining < 2) {
      return { label: `${Math.floor(hoursRemaining * 60)}m left`, color: 'red', urgent: true };
    } else if (hoursRemaining < 24) {
      return { label: `${Math.floor(hoursRemaining)}h left`, color: 'yellow', urgent: true };
    } else {
      const daysRemaining = Math.floor(hoursRemaining / 24);
      return { label: `${daysRemaining}d left`, color: 'green', urgent: false };
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 border border-red-200/50 bg-red-50/30">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  const needsLineup = upcomingFixtures.filter(f => !f.hasLineup && !f.isLocked);
  const hasLineupSubmitted = upcomingFixtures.filter(f => f.hasLineup && !f.isLocked);
  const locked = upcomingFixtures.filter(f => f.isLocked);

  return (
    <div className="glass rounded-2xl p-6 border border-blue-200/50 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Lineup Status</h3>
            <p className="text-xs text-gray-600">Upcoming fixtures</p>
          </div>
        </div>
        {needsLineup.length > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 animate-pulse">
            {needsLineup.length} Required
          </span>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
          <div className="text-2xl font-bold text-red-600">{needsLineup.length}</div>
          <div className="text-xs text-red-700 font-medium">Needs Lineup</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
          <div className="text-2xl font-bold text-green-600">{hasLineupSubmitted.length}</div>
          <div className="text-xs text-green-700 font-medium">Submitted</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">{locked.length}</div>
          <div className="text-xs text-gray-700 font-medium">Locked</div>
        </div>
      </div>

      {/* Fixtures List */}
      {upcomingFixtures.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-3">📋</div>
          <p className="text-sm text-gray-600">No upcoming fixtures</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingFixtures.map((status) => {
            const deadlineStatus = getDeadlineStatus(status.deadline);
            const needsAttention = !status.hasLineup && !status.isLocked;

            return (
              <div
                key={status.fixture.id}
                className={`rounded-lg p-4 border transition-all ${
                  needsAttention
                    ? 'bg-red-50 border-red-300 shadow-sm'
                    : status.isLocked
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-500">
                        R{status.fixture.round_number} M{status.fixture.match_number}
                      </span>
                      {needsAttention && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                          ⚠️ Action Required
                        </span>
                      )}
                      {status.isLocked && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-400 text-white">
                          🔒 Locked
                        </span>
                      )}
                      {status.hasLineup && !status.isLocked && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
                          ✓ Submitted
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {status.fixture.home_team_name} vs {status.fixture.away_team_name}
                    </div>
                    {status.fixture.scheduled_date && (
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(status.fixture.scheduled_date).toLocaleDateString()} at{' '}
                        {new Date(status.fixture.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  {deadlineStatus && !status.isLocked && (
                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                      deadlineStatus.color === 'red'
                        ? 'bg-red-100 text-red-700'
                        : deadlineStatus.color === 'yellow'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {deadlineStatus.label}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  {!status.isLocked && (
                    <Link
                      href={`/dashboard/team/fixture/${status.fixture.id}/lineup`}
                      className={`flex-1 text-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        needsAttention
                          ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {status.hasLineup ? 'Edit Lineup' : 'Submit Lineup'}
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/team/fixture/${status.fixture.id}`}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-all"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

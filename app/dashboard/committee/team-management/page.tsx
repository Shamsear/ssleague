import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSeasonById } from '@/lib/firebase/seasons';
import { getFixturesByRounds } from '@/lib/firebase/fixtures';
import { cookies } from 'next/headers';
import { getUserFromToken } from '@/lib/auth/server';
import TeamManagementClient from './team-management-client';

interface Team {
  team: {
    id: string;
    name: string;
    logoUrl?: string;
    balance: number;
    dollar_balance?: number;
    euro_balance?: number;
  };
  totalPlayers: number;
  totalValue: number;
  avgRating: number;
  positionBreakdown: { [key: string]: number };
  realPlayerSpent?: number;
  footballSpent?: number;
}

interface Match {
  id: string;
  round_number: number;
  leg: string;
  match_number: number;
  status: string;
  result: string;
  home_team_name: string;
  away_team_name: string;
  home_score?: number;
  away_score?: number;
  updated_at?: any;
  created_at?: any;
}

async function getTeamsData(userSeasonId: string, token: string) {
  try {
    console.log('[getTeamsData] Fetching season:', userSeasonId);
    const season = await getSeasonById(userSeasonId);
    if (!season) {
      console.log('[getTeamsData] Season not found');
      return { teams: [], seasonName: '', recentMatches: [] };
    }
    
    console.log('[getTeamsData] Season found:', season.name);

    // Fetch teams using the API route logic directly
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/team/all?season_id=${userSeasonId}`;
    console.log('[getTeamsData] Calling API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        'Cookie': `auth-token=${token}`,
      },
    });
    
    console.log('[getTeamsData] API response status:', response.status);
    const data = await response.json();
    console.log('[getTeamsData] API response:', data);

    const teams = data.success && data.data.teams ? data.data.teams : [];

    // Fetch recent matches
    let recentMatches: Match[] = [];
    try {
      const fixtureRounds = await getFixturesByRounds(userSeasonId);

      const allMatches = fixtureRounds.flatMap(round =>
        round.matches
          .filter(match => match.status === 'completed')
          .map(match => ({
            ...match,
            round_number: round.round_number,
            leg: round.leg
          }))
      );

      const sortedMatches = allMatches.sort((a, b) => {
        const dateA = a.updated_at || a.created_at || new Date(0);
        const dateB = b.updated_at || b.created_at || new Date(0);
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      recentMatches = sortedMatches.slice(0, 5);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }

    return { teams, seasonName: season.name, recentMatches };
  } catch (error) {
    console.error('Error fetching teams data:', error);
    return { teams: [], seasonName: '', recentMatches: [] };
  }
}

export default async function TeamManagementPage() {
  // Get user from server-side cookie
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login?redirect=/dashboard/committee/team-management');
  }

  const user = await getUserFromToken(token);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Authentication Error</h1>
          <p>User not found from token</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'committee_admin' && user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p>Your role: {user.role}</p>
          <p>Required: committee_admin or super_admin</p>
        </div>
      </div>
    );
  }

  // Get user's season ID (check both field names for compatibility)
  const userSeasonId = user.current_season_id || user.seasonId || '';
  
  console.log('[TeamManagement] User ID:', user.id);
  console.log('[TeamManagement] User role:', user.role);
  console.log('[TeamManagement] User current_season_id:', user.current_season_id);
  console.log('[TeamManagement] User seasonId:', user.seasonId);
  console.log('[TeamManagement] Using season ID:', userSeasonId);

  // Fetch all data server-side
  const { teams, seasonName, recentMatches } = userSeasonId
    ? await getTeamsData(userSeasonId, token)
    : { teams: [], seasonName: '', recentMatches: [] };
  
  console.log('[TeamManagement] Fetched teams count:', teams.length);
  console.log('[TeamManagement] Season name:', seasonName);
  console.log('[TeamManagement] Recent matches count:', recentMatches.length);

  return (
    <TeamManagementClient
      teams={teams}
      seasonName={seasonName}
      recentMatches={recentMatches}
    />
  );
}

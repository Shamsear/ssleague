import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export interface ExistingEntityData {
  players: Array<{
    id: string;
    name: string;
    player_id?: string;
  }>;
  teams: Array<{
    id: string;
    name: string;
    team_name?: string;
    teamId?: string;
    owner_name?: string;
  }>;
}

/**
 * GET /api/seasons/historical/check-duplicates
 * Fetches all existing players and teams from the database for duplicate checking
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch all existing players
    const playersSnapshot = await adminDb.collection('realplayers').get();
    const players = playersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || data.display_name || '',
        player_id: data.player_id || doc.id
      };
    });

    // Fetch all existing teams
    const teamsSnapshot = await adminDb.collection('teams').get();
    const teams = teamsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.team_name || data.name || '',
        team_name: data.team_name || data.name || '',
        teamId: data.team_id || doc.id,
        owner_name: data.owner_name || ''
      };
    });

    const response: ExistingEntityData = {
      players,
      teams
    };

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error: any) {
    console.error('Error fetching existing entities:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch existing entities'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/seasons/historical/check-duplicates
 * Check specific names against the database
 */
export async function POST(request: NextRequest) {
  try {
    const { players, teams } = await request.json();

    const results: {
      playerMatches: Map<string, any[]>;
      teamMatches: Map<string, any[]>;
    } = {
      playerMatches: new Map(),
      teamMatches: new Map()
    };

    // Check each player name
    if (players && Array.isArray(players)) {
      for (const playerName of players) {
        if (!playerName || typeof playerName !== 'string') continue;

        // Query for similar player names (case-insensitive)
        const normalizedName = playerName.toLowerCase().trim();
        
        const playersSnapshot = await adminDb
          .collection('realplayers')
          .get();

        const matches = playersSnapshot.docs
          .filter(doc => {
            const data = doc.data();
            const dbName = (data.name || data.display_name || '').toLowerCase().trim();
            
            // Exact match or contains
            return dbName === normalizedName || 
                   dbName.includes(normalizedName) || 
                   normalizedName.includes(dbName);
          })
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || data.display_name || '',
              player_id: data.player_id || doc.id
            };
          });

        if (matches.length > 0) {
          results.playerMatches.set(playerName, matches);
        }
      }
    }

    // Check each team name
    if (teams && Array.isArray(teams)) {
      for (const teamName of teams) {
        if (!teamName || typeof teamName !== 'string') continue;

        // Query for similar team names (case-insensitive)
        const normalizedName = teamName.toLowerCase().trim();
        
        const teamsSnapshot = await adminDb
          .collection('teams')
          .get();

        const matches = teamsSnapshot.docs
          .filter(doc => {
            const data = doc.data();
            const dbName = (data.team_name || data.name || '').toLowerCase().trim();
            
            // Exact match or contains
            return dbName === normalizedName || 
                   dbName.includes(normalizedName) || 
                   normalizedName.includes(dbName);
          })
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.team_name || data.name || '',
              team_name: data.team_name || data.name || ''
            };
          });

        if (matches.length > 0) {
          results.teamMatches.set(teamName, matches);
        }
      }
    }

    // Convert Maps to objects for JSON serialization
    return NextResponse.json({
      success: true,
      data: {
        playerMatches: Object.fromEntries(results.playerMatches),
        teamMatches: Object.fromEntries(results.teamMatches)
      }
    });

  } catch (error: any) {
    console.error('Error checking for duplicates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to check for duplicates'
      },
      { status: 500 }
    );
  }
}

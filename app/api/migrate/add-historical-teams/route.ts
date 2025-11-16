import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { query as pgQuery } from '@/lib/neon';

/**
 * This endpoint adds all historical teams from Firebase to Neon database
 * with their most recent/final name from the latest season they participated in
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Fetching all teams from Firebase team_seasons...');
    
    // Get all team_seasons documents
    const teamSeasonsRef = collection(db, 'team_seasons');
    const snapshot = await getDocs(teamSeasonsRef);
    
    // Map to store: team_id -> { latestSeasonId, latestName }
    const teamHistory = new Map<string, { 
      seasonId: string, 
      name: string,
      seasons: string[]
    }>();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const teamId = data.team_id;
      const teamName = data.team_name;
      const seasonId = data.season_id;
      
      if (!teamId || !teamName || !seasonId) return;
      
      // Track this team
      if (!teamHistory.has(teamId)) {
        teamHistory.set(teamId, {
          seasonId,
          name: teamName,
          seasons: [seasonId]
        });
      } else {
        const current = teamHistory.get(teamId)!;
        current.seasons.push(seasonId);
        
        // Update to latest season (compare season IDs)
        // Assuming format: SSPSLS0001, SSPSLS0002, etc.
        if (seasonId > current.seasonId) {
          current.seasonId = seasonId;
          current.name = teamName;
        }
      }
    });
    
    console.log(`📊 Found ${teamHistory.size} unique teams in Firebase`);
    
    // Get existing teams from Neon
    const existingTeams = await pgQuery('SELECT team_uid FROM teams');
    const existingIds = new Set(existingTeams.rows.map(t => t.team_uid));
    
    console.log(`📊 Found ${existingIds.size} teams already in Neon`);
    
    // Filter to only teams NOT in Neon
    const teamsToAdd: Array<{
      team_id: string;
      final_name: string;
      seasons: string[];
      latest_season: string;
    }> = [];
    
    teamHistory.forEach((data, teamId) => {
      if (!existingIds.has(teamId)) {
        teamsToAdd.push({
          team_id: teamId,
          final_name: data.name,
          seasons: data.seasons,
          latest_season: data.seasonId
        });
      }
    });
    
    console.log(`➕ Need to add ${teamsToAdd.length} teams to Neon`);
    
    if (teamsToAdd.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All historical teams are already in Neon database',
        stats: {
          totalInFirebase: teamHistory.size,
          alreadyInNeon: existingIds.size,
          added: 0
        }
      });
    }
    
    // Insert teams into Neon
    const inserted: string[] = [];
    const errors: Array<{ team_id: string; error: string }> = [];
    
    for (const team of teamsToAdd) {
      try {
        await pgQuery(
          `INSERT INTO teams (
            team_uid, 
            team_name, 
            is_active,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (team_uid) DO NOTHING`,
          [team.team_id, team.final_name, false]
        );
        
        inserted.push(team.team_id);
        console.log(`✅ Added: ${team.team_id} -> ${team.final_name}`);
      } catch (error: any) {
        errors.push({ 
          team_id: team.team_id, 
          error: error.message 
        });
        console.error(`❌ Error adding ${team.team_id}:`, error.message);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully added ${inserted.length} historical teams to Neon`,
      stats: {
        totalInFirebase: teamHistory.size,
        alreadyInNeon: existingIds.size,
        attempted: teamsToAdd.length,
        successful: inserted.length,
        failed: errors.length
      },
      inserted,
      errors: errors.length > 0 ? errors : undefined,
      preview: teamsToAdd.slice(0, 10).map(t => ({
        id: t.team_id,
        name: t.final_name,
        latestSeason: t.latest_season
      }))
    });
    
  } catch (error: any) {
    console.error('Error adding historical teams:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET endpoint to preview what teams will be added
 */
export async function GET(request: NextRequest) {
  try {
    // Get all team_seasons documents
    const teamSeasonsRef = collection(db, 'team_seasons');
    const snapshot = await getDocs(teamSeasonsRef);
    
    // Map to store: team_id -> { latestSeasonId, latestName }
    const teamHistory = new Map<string, { 
      seasonId: string, 
      name: string,
      seasons: string[]
    }>();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const teamId = data.team_id;
      const teamName = data.team_name;
      const seasonId = data.season_id;
      
      if (!teamId || !teamName || !seasonId) return;
      
      if (!teamHistory.has(teamId)) {
        teamHistory.set(teamId, {
          seasonId,
          name: teamName,
          seasons: [seasonId]
        });
      } else {
        const current = teamHistory.get(teamId)!;
        current.seasons.push(seasonId);
        
        if (seasonId > current.seasonId) {
          current.seasonId = seasonId;
          current.name = teamName;
        }
      }
    });
    
    // Get existing teams from Neon
    const existingTeams = await pgQuery('SELECT team_uid, team_name FROM teams');
    const existingMap = new Map(existingTeams.rows.map(t => [t.team_uid, t.team_name]));
    
    // Categorize teams
    const inBoth: any[] = [];
    const onlyInFirebase: any[] = [];
    
    teamHistory.forEach((data, teamId) => {
      const teamInfo = {
        team_id: teamId,
        firebase_final_name: data.name,
        latest_season: data.seasonId,
        total_seasons: data.seasons.length,
        seasons: data.seasons.sort()
      };
      
      if (existingMap.has(teamId)) {
        inBoth.push({
          ...teamInfo,
          neon_name: existingMap.get(teamId)
        });
      } else {
        onlyInFirebase.push(teamInfo);
      }
    });
    
    return NextResponse.json({
      success: true,
      summary: {
        totalUniqueTeams: teamHistory.size,
        inBothSystems: inBoth.length,
        onlyInFirebase: onlyInFirebase.length,
        onlyInNeon: existingTeams.rows.length - inBoth.length
      },
      teamsToAdd: onlyInFirebase,
      existingTeams: inBoth
    });
    
  } catch (error: any) {
    console.error('Error previewing teams:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

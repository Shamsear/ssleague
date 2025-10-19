import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import * as XLSX from 'xlsx';

interface PreviewTeamData {
  team_name: string;
  owner_name: string;
  // Team standings data
  rank?: number;
  p?: number;
  mp?: number;
  w?: number;
  d?: number;
  l?: number;
  f?: number;
  a?: number;
  gd?: number;
  percentage?: number;
  cup?: string;
}

interface PreviewPlayerData {
  name: string;
  team: string;
  category: string;
  goals_scored: number | null;
  goals_per_game: number | null;
  goals_conceded: number | null;
  conceded_per_game: number | null;
  net_goals: number | null;
  cleansheets: number | null;
  points: number | null;
  win: number;
  draw: number;
  loss: number;
  total_matches: number;
  total_points: number | null;
  // Optional fields
  average_rating?: number;
  potm?: number | null; // Player of the Match (nullable)
  category_trophies?: string[];  // Changed to array for unlimited trophies
  individual_trophies?: string[]; // Changed to array for unlimited trophies
}


interface PreviewData {
  teams: PreviewTeamData[];
  players: PreviewPlayerData[];
  errors: string[];
  warnings: string[];
  summary: {
    teamsCount: number;
    playersCount: number;
    errorsCount: number;
    warningsCount: number;
  };
}

// Helper function to safely convert value to number
const safeNumber = (value: any, defaultValue: number | null | undefined = 0): number | null | undefined => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? defaultValue : num;
};

// Helper function to safely convert value to string
const safeString = (value: any, defaultValue: string | undefined = ''): string | undefined => {
  if (value === null || value === undefined) return defaultValue;
  return String(value).trim();
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;
    console.log(`📝 Parsing Excel file for historical season ID: ${seasonId}`);

    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // For parsing, we'll skip the user role check for simplicity, but in production
    // you might want to keep the role check for security
    console.log(`✅ User authenticated: ${decodedToken.uid}`);

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'Invalid file format. Please upload an Excel file.' }, { status: 400 });
    }

    // Read Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const previewData: PreviewData = {
      teams: [],
      players: [],
      errors: [],
      warnings: [],
      summary: {
        teamsCount: 0,
        playersCount: 0,
        errorsCount: 0,
        warningsCount: 0,
      }
    };

    // Process Teams sheet
    if (workbook.SheetNames.includes('Teams')) {
      console.log('📊 Parsing Teams sheet...');
      try {
        const teamsSheet = workbook.Sheets['Teams'];
        const teamsData = XLSX.utils.sheet_to_json(teamsSheet);
        
        // Debug: Log first row to see column names
        if (teamsData.length > 0) {
          console.log('📋 Teams sheet columns:', Object.keys(teamsData[0]));
          console.log('📋 First team row data:', teamsData[0]);
        }

        for (const row of teamsData as any[]) {
          try {
            const teamData: PreviewTeamData = {
              team_name: safeString(
                row.team || row.team_name || row.Team || row['Team Name'] || row.TEAM || 
                row.TeamName || row['team name'] || row.name || row.Name
              ),
              owner_name: safeString(
                row.owner_name || row.Owner || row['Owner Name'] || row.owner || row.OWNER || 
                row.OwnerName || row['owner name']
              ),
              // Team standings data - exact column names from export
              rank: safeNumber(row.rank || row.Rank || row.Position, undefined),
              p: safeNumber(row.p || row.P || row.points || row.Points, undefined),
              mp: safeNumber(row.mp || row.MP || row.matches_played || row['Matches Played'], undefined),
              w: safeNumber(row.w || row.W || row.wins || row.Wins, undefined),
              d: safeNumber(row.d || row.D || row.draws || row.Draws, undefined),
              l: safeNumber(row.l || row.L || row.losses || row.Losses, undefined),
              f: safeNumber(row.f || row.F || row.goals_for || row['Goals For'], undefined),
              a: safeNumber(row.a || row.A || row.goals_against || row['Goals Against'], undefined),
              gd: safeNumber(row.gd || row.GD || row.goal_difference || row['Goal Difference'], undefined),
              percentage: safeNumber(row.percentage || row.Percentage || row['Win %'], undefined),
              cup: safeString(row.cup || row.Cup || row.Trophy, undefined)
            };
            
            console.log(`🔍 Parsed team: ${teamData.team_name}, rank=${teamData.rank}, p=${teamData.p}, w=${teamData.w}`);

            // Validate required fields
            if (!teamData.team_name) {
              previewData.errors.push(`Teams sheet: Row missing team name`);
              continue;
            }

            previewData.teams.push(teamData);
          } catch (error: any) {
            previewData.errors.push(`Teams sheet: Error processing row - ${error.message}`);
          }
        }
        
        previewData.summary.teamsCount = previewData.teams.length;
        console.log(`✅ Parsed ${previewData.teams.length} teams`);
      } catch (error: any) {
        previewData.errors.push(`Teams sheet: ${error.message}`);
      }
    }

    // Process Players sheet
    if (workbook.SheetNames.includes('Players')) {
      console.log('📊 Parsing Players sheet...');
      try {
        const playersSheet = workbook.Sheets['Players'];
        const playersData = XLSX.utils.sheet_to_json(playersSheet);

        for (const row of playersData as any[]) {
          try {
            // Parse all category and individual trophies dynamically
            const categoryTrophies: string[] = [];
            const individualTrophies: string[] = [];
            
            // Check all possible column names for trophies
            Object.keys(row).forEach(key => {
              const lowerKey = key.toLowerCase();
              const value = safeString(row[key], undefined);
              
              if (value && value.trim() && value.trim().toLowerCase() !== 'null') {
                // Match category trophies: category_wise_trophy_N, Category Trophy N, Cat Trophy N, etc.
                if ((lowerKey.includes('category') || lowerKey.includes('cat')) && lowerKey.includes('trophy')) {
                  categoryTrophies.push(value.trim());
                }
                // Match individual trophies: individual_wise_trophy_N, Individual Trophy N, Ind Trophy N, etc.
                else if ((lowerKey.includes('individual') || lowerKey.includes('ind')) && lowerKey.includes('trophy')) {
                  individualTrophies.push(value.trim());
                }
              }
            });
            
            const playerData: PreviewPlayerData = {
              name: safeString(row.name || row.Name || row['Player Name']),
              team: safeString(row.team || row.Team),
              category: safeString(row.category || row.Category || row.Position),
              goals_scored: safeNumber(row.goals_scored || row.Goals || row['Goals Scored'], null),
              goals_per_game: safeNumber(row.goals_per_game || row['Goals/Game'] || row['Goals Per Game'], null),
              goals_conceded: safeNumber(row.goals_conceded || row['Goals Conceded'] || row.Conceded, null),
              conceded_per_game: safeNumber(row.conceded_per_game || row['Conceded/Game'] || row['Conceded Per Game'], null),
              net_goals: safeNumber(row.net_goals || row['Net Goals'], null),
              cleansheets: safeNumber(row.cleansheets || row['Clean Sheets'] || row.Cleansheets, null),
              points: safeNumber(row.points || row.Points, null),
              win: safeNumber(row.win || row.Win || row.Wins, 0),
              draw: safeNumber(row.draw || row.Draw || row.Draws, 0),
              loss: safeNumber(row.loss || row.Loss || row.Losses, 0),
              total_matches: safeNumber(row.total_matches || row['Total Matches'] || row.Matches, 0),
              total_points: safeNumber(row.total_points || row['Total Points'], null),
              // Optional fields
              average_rating: safeNumber(row.average_rating || row['Average Rating'] || row.Rating, undefined),
              potm: safeNumber(row.potm || row.POTM || row['Player of the Match'], null), // Player of the Match (nullable)
              category_trophies: categoryTrophies.length > 0 ? categoryTrophies : undefined,
              individual_trophies: individualTrophies.length > 0 ? individualTrophies : undefined
            };

            // Validate required fields
            if (!playerData.name) {
              previewData.errors.push(`Players sheet: Row missing player name`);
              continue;
            }

            // Add warnings for potential issues
            if (!playerData.team) {
              previewData.warnings.push(`Player "${playerData.name}" has no team assigned`);
            }

            if (!playerData.category) {
              previewData.warnings.push(`Player "${playerData.name}" has no category/position`);
            }

            // Check if wins + draws + losses equals total matches
            const calculatedMatches = playerData.win + playerData.draw + playerData.loss;
            if (calculatedMatches !== playerData.total_matches && playerData.total_matches > 0) {
              previewData.warnings.push(`Player "${playerData.name}": Win(${playerData.win}) + Draw(${playerData.draw}) + Loss(${playerData.loss}) = ${calculatedMatches} does not equal Total Matches(${playerData.total_matches})`);
            }

            previewData.players.push(playerData);
          } catch (error: any) {
            previewData.errors.push(`Players sheet: Error processing row - ${error.message}`);
          }
        }
        
        previewData.summary.playersCount = previewData.players.length;
        console.log(`✅ Parsed ${previewData.players.length} players`);
      } catch (error: any) {
        previewData.errors.push(`Players sheet: ${error.message}`);
      }
    }

    // Finalize summary
    previewData.summary.errorsCount = previewData.errors.length;
    previewData.summary.warningsCount = previewData.warnings.length;

    // NOTE: Team cross-reference validation is done in the frontend against database teams
    // (including previous team names), not against Teams sheet, so we skip it here

    console.log(`✅ Excel parsing completed successfully:`);
    console.log(`  - Teams: ${previewData.summary.teamsCount}`);
    console.log(`  - Players: ${previewData.summary.playersCount}`);
    console.log(`  - Errors: ${previewData.summary.errorsCount}`);
    console.log(`  - Warnings: ${previewData.summary.warningsCount}`);

    return NextResponse.json({
      success: true,
      data: previewData
    });

  } catch (error: any) {
    console.error('❌ Error parsing Excel file:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to parse Excel file'
      }, 
      { status: 500 }
    );
  }
}
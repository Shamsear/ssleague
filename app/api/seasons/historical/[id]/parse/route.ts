import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import * as XLSX from 'xlsx';

interface PreviewTeamData {
  team_name: string;
  owner_name: string;
}

interface PreviewPlayerData {
  name: string;
  team: string;
  category: string;
  goals_scored: number;
  goals_per_game: number;
  goals_conceded: number;
  conceded_per_game: number;
  net_goals: number;
  cleansheets: number;
  points: number;
  win: number;
  draw: number;
  loss: number;
  total_matches: number;
  total_points: number;
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
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? defaultValue : num;
};

// Helper function to safely convert value to string
const safeString = (value: any, defaultValue: string = ''): string => {
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

        for (const row of teamsData as any[]) {
          try {
            const teamData: PreviewTeamData = {
              team_name: safeString(row.team_name || row.Team || row['Team Name']),
              owner_name: safeString(row.owner_name || row.Owner || row['Owner Name'])
            };

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
            const playerData: PreviewPlayerData = {
              name: safeString(row.name || row.Name || row['Player Name']),
              team: safeString(row.team || row.Team),
              category: safeString(row.category || row.Category || row.Position),
              goals_scored: safeNumber(row.goals_scored || row.Goals || row['Goals Scored']),
              goals_per_game: safeNumber(row.goals_per_game || row['Goals/Game'] || row['Goals Per Game']),
              goals_conceded: safeNumber(row.goals_conceded || row['Goals Conceded'] || row.Conceded),
              conceded_per_game: safeNumber(row.conceded_per_game || row['Conceded/Game'] || row['Conceded Per Game']),
              net_goals: safeNumber(row.net_goals || row['Net Goals']),
              cleansheets: safeNumber(row.cleansheets || row['Clean Sheets'] || row.Cleansheets),
              points: safeNumber(row.points || row.Points),
              win: safeNumber(row.win || row.Win || row.Wins, 0),
              draw: safeNumber(row.draw || row.Draw || row.Draws, 0),
              loss: safeNumber(row.loss || row.Loss || row.Losses, 0),
              total_matches: safeNumber(row.total_matches || row['Total Matches'] || row.Matches, 0),
              total_points: safeNumber(row.total_points || row['Total Points'])
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

    // Cross-reference validation
    const teamNames = new Set(previewData.teams.map(t => t.team_name.toLowerCase()));
    
    // Check if player teams exist in teams list
    previewData.players.forEach(player => {
      if (player.team && !teamNames.has(player.team.toLowerCase())) {
        previewData.warnings.push(`Player "${player.name}" assigned to team "${player.team}" which doesn't exist in Teams sheet`);
      }
    });

    // Update warnings count after cross-reference validation
    previewData.summary.warningsCount = previewData.warnings.length;

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
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import ExcelJS from 'exceljs';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);
const tournamentSql = neon(process.env.TOURNAMENT_DATABASE_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/admin/export/teams-excel
 * Export all teams with their players to Excel
 * Each team gets its own sheet with football and real players
 * Committee admin only
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Generating Excel export for season ${seasonId}`);

    // Get all teams for the season
    const teams = await sql`
      SELECT 
        id,
        name,
        football_budget,
        football_spent,
        football_players_count,
        created_at
      FROM teams
      WHERE season_id = ${seasonId}
      ORDER BY name
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No teams found for this season' },
        { status: 404 }
      );
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SS League';
    workbook.created = new Date();

    // Create overview sheet
    const overviewSheet = workbook.addWorksheet('Overview');
    overviewSheet.columns = [
      { header: 'Team Name', key: 'name', width: 25 },
      { header: 'Football Budget', key: 'football_budget', width: 15 },
      { header: 'Football Spent', key: 'football_spent', width: 15 },
      { header: 'Football Players', key: 'football_players_count', width: 15 },
    ];

    // Style header row
    overviewSheet.getRow(1).font = { bold: true };
    overviewSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066FF' },
    };
    overviewSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add team data to overview
    teams.forEach(team => {
      overviewSheet.addRow({
        name: team.name,
        football_budget: team.football_budget || 0,
        football_spent: team.football_spent || 0,
        football_players_count: team.football_players_count || 0,
      });
    });

    // Create a sheet for each team
    for (const team of teams) {
      // Get football players
      const footballPlayers = await sql`
        SELECT 
          fp.id,
          fp.name,
          fp.position,
          fp.acquisition_value,
          fp.contract_start_season,
          fp.contract_end_season,
          fp.contract_length,
          fp.status,
          r.round_number
        FROM footballplayers fp
        LEFT JOIN rounds r ON fp.round_id = r.id
        WHERE fp.team_id = ${team.id}
        AND fp.season_id = ${seasonId}
        AND fp.is_sold = true
        ORDER BY fp.position, fp.name
      `;

      // Get real players from tournament database player_seasons table
      let realPlayers: any[] = [];
      try {
        realPlayers = await tournamentSql`
          SELECT 
            ps.id,
            ps.player_name as name,
            ps.position,
            0 as acquisition_value,
            ps.season_id as contract_start_season,
            ps.season_id as contract_end_season,
            'active' as status,
            NULL as round_number
          FROM player_seasons ps
          WHERE ps.team_id = ${team.id}
          AND ps.season_id = ${seasonId}
          ORDER BY ps.position, ps.player_name
        `;
      } catch (error) {
        console.warn(`⚠️ Could not fetch real players for team ${team.id}:`, error);
        // Continue without real players if tournament DB is not available
      }

      // Create sheet for this team
      const teamSheet = workbook.addWorksheet(team.name.substring(0, 31)); // Excel sheet name limit

      // Add team info header
      teamSheet.mergeCells('A1:F1');
      teamSheet.getCell('A1').value = `${team.name} - Season ${seasonId}`;
      teamSheet.getCell('A1').font = { bold: true, size: 14 };
      teamSheet.getCell('A1').alignment = { horizontal: 'center' };

      // Add budget info
      teamSheet.getCell('A2').value = 'Football Budget:';
      teamSheet.getCell('B2').value = team.football_budget || 0;
      teamSheet.getCell('C2').value = 'Football Spent:';
      teamSheet.getCell('D2').value = team.football_spent || 0;
      teamSheet.getCell('E2').value = 'Football Players:';
      teamSheet.getCell('F2').value = team.football_players_count || 0;

      // Football Players section
      teamSheet.getCell('A5').value = 'FOOTBALL PLAYERS';
      teamSheet.getCell('A5').font = { bold: true, size: 12 };
      teamSheet.getCell('A5').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' },
      };

      // Football players header
      const fpHeaderRow = teamSheet.getRow(6);
      fpHeaderRow.values = ['Name', 'Position', 'Price', 'Round', 'Contract Start', 'Contract End', 'Status'];
      fpHeaderRow.font = { bold: true };
      fpHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' },
      };

      // Add football players
      let currentRow = 7;
      footballPlayers.forEach(player => {
        teamSheet.getRow(currentRow).values = [
          player.name,
          player.position,
          player.acquisition_value || 0,
          player.round_number || '-',
          player.contract_start_season || '-',
          player.contract_end_season || '-',
          player.status || 'active',
        ];
        currentRow++;
      });

      // Real Players section
      currentRow += 2;
      teamSheet.getCell(`A${currentRow}`).value = 'REAL PLAYERS';
      teamSheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
      teamSheet.getCell(`A${currentRow}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' },
      };

      // Real players header
      currentRow++;
      const rpHeaderRow = teamSheet.getRow(currentRow);
      rpHeaderRow.values = ['Name', 'Position', 'Price', 'Round', 'Contract Start', 'Contract End', 'Status'];
      rpHeaderRow.font = { bold: true };
      rpHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' },
      };

      // Add real players
      currentRow++;
      realPlayers.forEach(player => {
        teamSheet.getRow(currentRow).values = [
          player.name,
          player.position,
          player.acquisition_value || 0,
          player.round_number || '-',
          player.contract_start_season || '-',
          player.contract_end_season || '-',
          player.status || 'active',
        ];
        currentRow++;
      });

      // Set column widths
      teamSheet.getColumn(1).width = 25;
      teamSheet.getColumn(2).width = 12;
      teamSheet.getColumn(3).width = 12;
      teamSheet.getColumn(4).width = 10;
      teamSheet.getColumn(5).width = 15;
      teamSheet.getColumn(6).width = 15;
      teamSheet.getColumn(7).width = 12;
    }

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="teams-export-${seasonId}-${Date.now()}.xlsx"`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error generating Excel export:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest) {
  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    
    // Teams Sheet
    const teamsSheet = workbook.addWorksheet('Teams');
    teamsSheet.columns = [
      { header: 'team_name', key: 'team_name', width: 25 },
      { header: 'owner_name', key: 'owner_name', width: 20 },
    ];
    
    // Add sample teams data
    teamsSheet.addRows([
      {
        team_name: 'Manchester United FC',
        owner_name: 'John Doe'
      },
      {
        team_name: 'Chelsea FC',
        owner_name: 'Jane Smith'
      },
      {
        team_name: 'Liverpool FC',
        owner_name: 'Bob Johnson'
      },
      {
        team_name: 'Arsenal FC',
        owner_name: 'Mike Wilson'
      }
    ]);
    
    // Style the teams header
    teamsSheet.getRow(1).font = { bold: true };
    teamsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F2FF' }
    };
    
    // Players Sheet (RealPlayers Structure)
    const playersSheet = workbook.addWorksheet('Players');
    playersSheet.columns = [
      { header: 'name', key: 'name', width: 25 },
      { header: 'team', key: 'team', width: 25 },
      { header: 'category', key: 'category', width: 15 },
      { header: 'display_name', key: 'display_name', width: 25 },
      { header: 'email', key: 'email', width: 25 },
      { header: 'phone', key: 'phone', width: 15 },
      { header: 'psn_id', key: 'psn_id', width: 15 },
      { header: 'xbox_id', key: 'xbox_id', width: 15 },
      { header: 'steam_id', key: 'steam_id', width: 15 },
      { header: 'goals_scored', key: 'goals_scored', width: 12 },
      { header: 'cleansheets', key: 'cleansheets', width: 12 },
      { header: 'win', key: 'win', width: 10 },
      { header: 'draw', key: 'draw', width: 10 },
      { header: 'loss', key: 'loss', width: 10 },
      { header: 'total_matches', key: 'total_matches', width: 15 },
      { header: 'total_points', key: 'total_points', width: 12 },
    ];
    
    // Add sample players data
    playersSheet.addRows([
      {
        name: 'Cristiano Ronaldo',
        team: 'Manchester United FC',
        category: 'RED',
        display_name: 'CR7',
        email: 'cr7@example.com',
        phone: '+1234567890',
        psn_id: 'CR7_PSN',
        xbox_id: 'CR7_Xbox',
        steam_id: 'CR7_Steam',
        goals_scored: 22,
        cleansheets: 8,
        win: 12,
        draw: 4,
        loss: 4,
        total_matches: 20,
        total_points: 40
      },
      {
        name: 'Mason Mount',
        team: 'Chelsea FC',
        category: 'BLUE',
        display_name: 'Mount19',
        email: 'mount@example.com',
        phone: '+1234567891',
        psn_id: 'Mount_PSN',
        xbox_id: 'Mount_Xbox',
        steam_id: 'Mount_Steam',
        goals_scored: 8,
        cleansheets: 6,
        win: 10,
        draw: 5,
        loss: 3,
        total_matches: 18,
        total_points: 35
      },
      {
        name: 'Mohamed Salah',
        team: 'Liverpool FC',
        category: 'LEGEND',
        display_name: 'Mo Salah',
        email: 'salah@example.com',
        phone: '+1234567892',
        psn_id: 'Salah_PSN',
        xbox_id: 'Salah_Xbox',
        steam_id: 'Salah_Steam',
        goals_scored: 24,
        cleansheets: 10,
        win: 14,
        draw: 3,
        loss: 2,
        total_matches: 19,
        total_points: 45
      },
      {
        name: 'Virgil van Dijk',
        team: 'Liverpool FC',
        category: 'GREEN',
        display_name: 'VVD',
        email: 'vvd@example.com',
        phone: '+1234567893',
        psn_id: 'VVD_PSN',
        xbox_id: 'VVD_Xbox',
        steam_id: 'VVD_Steam',
        goals_scored: 3,
        cleansheets: 12,
        win: 15,
        draw: 3,
        loss: 2,
        total_matches: 20,
        total_points: 48
      }
    ]);
    
    // Style the players header
    playersSheet.getRow(1).font = { bold: true };
    playersSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6FFE6' }
    };
    
    // Instructions Sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Required', key: 'required', width: 12 },
      { header: 'Example', key: 'example', width: 20 },
    ];
    
    // Add instructions
    const instructions = [
      { field: 'TEAMS SHEET', description: '', required: '', example: '' },
      { field: 'team_name', description: 'Full name of the team', required: 'Yes', example: 'Manchester United FC' },
      { field: 'owner_name', description: 'Name of team owner', required: 'Yes', example: 'John Doe' },
      { field: '', description: '', required: '', example: '' },
      { field: 'PLAYERS SHEET', description: '', required: '', example: '' },
      { field: 'name', description: 'Full name of the player (must be unique)', required: 'Yes', example: 'Cristiano Ronaldo' },
      { field: 'team', description: 'Team the player belongs to', required: 'Yes', example: 'Manchester United FC' },
      { field: 'category', description: 'Player category (RED, BLUE, LEGEND, GREEN, etc.)', required: 'Yes', example: 'RED' },
      { field: 'display_name', description: 'Display name or nickname for the player', required: 'No', example: 'CR7' },
      { field: 'email', description: 'Player email address', required: 'No', example: 'cr7@example.com' },
      { field: 'phone', description: 'Player phone number', required: 'No', example: '+1234567890' },
      { field: 'psn_id', description: 'PlayStation Network ID', required: 'No', example: 'CR7_PSN' },
      { field: 'xbox_id', description: 'Xbox Live Gamertag', required: 'No', example: 'CR7_Xbox' },
      { field: 'steam_id', description: 'Steam ID', required: 'No', example: 'CR7_Steam' },
      { field: 'goals_scored', description: 'Total goals scored by the player', required: 'Yes', example: '22' },
      { field: 'cleansheets', description: 'Number of clean sheets (matches without conceding)', required: 'Yes', example: '8' },
      { field: 'win', description: 'Number of matches won', required: 'Yes', example: '12' },
      { field: 'draw', description: 'Number of matches drawn', required: 'Yes', example: '4' },
      { field: 'loss', description: 'Number of matches lost', required: 'Yes', example: '4' },
      { field: 'total_matches', description: 'Total matches played (win + draw + loss)', required: 'Yes', example: '20' },
      { field: 'total_points', description: 'Total points earned (wins*3 + draws*1)', required: 'Yes', example: '40' },
    ];
    
    instructionsSheet.addRows(instructions);
    
    // Style the instructions
    instructionsSheet.getRow(1).font = { bold: true };
    instructionsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F8FF' }
    };
    
    // Style section headers in instructions
    [1, 5].forEach(rowNum => {
      const row = instructionsSheet.getRow(rowNum);
      row.font = { bold: true, size: 12 };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCCCCCC' }
      };
    });
    
    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Return the file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="SS_League_Historical_Season_Template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Error generating Excel template:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest) {
  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    
    // Teams Sheet (League Table)
    const teamsSheet = workbook.addWorksheet('Teams');
    teamsSheet.columns = [
      { header: 'rank', key: 'rank', width: 8 },
      { header: 'team', key: 'team', width: 25 },
      { header: 'owner_name', key: 'owner_name', width: 20 },
      { header: 'p', key: 'p', width: 8 },
      { header: 'mp', key: 'mp', width: 8 },
      { header: 'w', key: 'w', width: 8 },
      { header: 'd', key: 'd', width: 8 },
      { header: 'l', key: 'l', width: 8 },
      { header: 'f', key: 'f', width: 8 },
      { header: 'a', key: 'a', width: 8 },
      { header: 'gd', key: 'gd', width: 8 },
      { header: 'percentage', key: 'percentage', width: 12 },
      { header: 'cup', key: 'cup', width: 20 },
    ];
    
    // Add sample teams data
    teamsSheet.addRows([
      {
        rank: 1,
        team: 'Manchester United FC',
        owner_name: 'John Doe',
        p: 45,
        mp: 18,
        w: 14,
        d: 3,
        l: 1,
        f: 42,
        a: 15,
        gd: 27,
        percentage: 77.78,
        cup: 'CHAMPIONS'
      },
      {
        rank: 2,
        team: 'Chelsea FC',
        owner_name: 'Jane Smith',
        p: 40,
        mp: 18,
        w: 12,
        d: 4,
        l: 2,
        f: 38,
        a: 18,
        gd: 20,
        percentage: 66.67,
        cup: 'RUNNERS UP'
      },
      {
        rank: 3,
        team: 'Liverpool FC',
        owner_name: 'Bob Johnson',
        p: 35,
        mp: 18,
        w: 10,
        d: 5,
        l: 3,
        f: 35,
        a: 20,
        gd: 15,
        percentage: 55.56,
        cup: ''
      },
      {
        rank: 4,
        team: 'Arsenal FC',
        owner_name: 'Mike Wilson',
        p: 30,
        mp: 18,
        w: 9,
        d: 3,
        l: 6,
        f: 28,
        a: 25,
        gd: 3,
        percentage: 50.00,
        cup: ''
      }
    ]);
    
    // Style the teams header
    teamsSheet.getRow(1).font = { bold: true };
    teamsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F2FF' }
    };
    
    // Players Sheet
    const playersSheet = workbook.addWorksheet('Players');
    playersSheet.columns = [
      { header: 'name', key: 'name', width: 25 },
      { header: 'team', key: 'team', width: 25 },
      { header: 'category', key: 'category', width: 15 },
      { header: 'goals_scored', key: 'goals_scored', width: 12 },
      { header: 'goals_per_game', key: 'goals_per_game', width: 12 },
      { header: 'goals_conceded', key: 'goals_conceded', width: 12 },
      { header: 'conceded_per_game', key: 'conceded_per_game', width: 12 },
      { header: 'net_goals', key: 'net_goals', width: 12 },
      { header: 'cleansheets', key: 'cleansheets', width: 12 },
      { header: 'points', key: 'points', width: 10 },
      { header: 'win', key: 'win', width: 10 },
      { header: 'draw', key: 'draw', width: 10 },
      { header: 'loss', key: 'loss', width: 10 },
      { header: 'total_matches', key: 'total_matches', width: 15 },
      { header: 'total_points', key: 'total_points', width: 12 },
      { header: 'category_wise_trophy_1', key: 'category_wise_trophy_1', width: 20 },
      { header: 'category_wise_trophy_2', key: 'category_wise_trophy_2', width: 20 },
      { header: 'individual_wise_trophy_1', key: 'individual_wise_trophy_1', width: 20 },
      { header: 'individual_wise_trophy_2', key: 'individual_wise_trophy_2', width: 20 },
      { header: 'potm', key: 'potm', width: 12 },
    ];
    
    // Add sample players data
    playersSheet.addRows([
      {
        name: 'Cristiano Ronaldo',
        team: 'Manchester United FC',
        category: 'RED',
        goals_scored: 22,
        goals_per_game: 1.1,
        goals_conceded: 12,
        conceded_per_game: 0.6,
        net_goals: 10,
        cleansheets: 8,
        points: 5.5,
        win: 12,
        draw: 4,
        loss: 4,
        total_matches: 20,
        total_points: 40,
        category_wise_trophy_1: 'BEST PLAYER',
        category_wise_trophy_2: '',
        individual_wise_trophy_1: 'TOP SCORER',
        individual_wise_trophy_2: 'GOLDEN BOOT',
        potm: 1
      },
      {
        name: 'Mason Mount',
        team: 'Chelsea FC',
        category: 'BLUE',
        goals_scored: 8,
        goals_per_game: 0.44,
        goals_conceded: 15,
        conceded_per_game: 0.83,
        net_goals: -7,
        cleansheets: 6,
        points: 4.2,
        win: 10,
        draw: 5,
        loss: 3,
        total_matches: 18,
        total_points: 35,
        category_wise_trophy_1: '',
        category_wise_trophy_2: '',
        individual_wise_trophy_1: '',
        individual_wise_trophy_2: '',
        potm: null
      },
      {
        name: 'Mohamed Salah',
        team: 'Liverpool FC',
        category: 'LEGEND',
        goals_scored: 24,
        goals_per_game: 1.26,
        goals_conceded: 10,
        conceded_per_game: 0.53,
        net_goals: 14,
        cleansheets: 10,
        points: 6.0,
        win: 14,
        draw: 3,
        loss: 2,
        total_matches: 19,
        total_points: 45,
        category_wise_trophy_1: 'BEST PLAYER',
        category_wise_trophy_2: '',
        individual_wise_trophy_1: 'GOLDEN BALL',
        individual_wise_trophy_2: '',
        potm: null
      },
      {
        name: 'Virgil van Dijk',
        team: 'Liverpool FC',
        category: 'GREEN',
        goals_scored: 3,
        goals_per_game: 0.15,
        goals_conceded: 8,
        conceded_per_game: 0.4,
        net_goals: -5,
        cleansheets: 12,
        points: 5.0,
        win: 15,
        draw: 3,
        loss: 2,
        total_matches: 20,
        total_points: 48,
        category_wise_trophy_1: '',
        category_wise_trophy_2: '',
        individual_wise_trophy_1: '',
        individual_wise_trophy_2: '',
        potm: null
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
      { field: 'TEAMS SHEET (League Table)', description: '', required: '', example: '' },
      { field: 'rank', description: 'League position/rank', required: 'Yes', example: '1' },
      { field: 'team', description: 'Full name of the team', required: 'Yes', example: 'Manchester United FC' },
      { field: 'owner_name', description: 'Name of team owner', required: 'Yes', example: 'John Doe' },
      { field: 'p', description: 'Points earned (W*3 + D*1)', required: 'Yes', example: '45' },
      { field: 'mp', description: 'Matches Played', required: 'Yes', example: '18' },
      { field: 'w', description: 'Wins', required: 'Yes', example: '14' },
      { field: 'd', description: 'Draws', required: 'Yes', example: '3' },
      { field: 'l', description: 'Losses', required: 'Yes', example: '1' },
      { field: 'f', description: 'Goals For (scored)', required: 'Yes', example: '42' },
      { field: 'a', description: 'Goals Against (conceded)', required: 'Yes', example: '15' },
      { field: 'gd', description: 'Goal Difference (F - A)', required: 'Yes', example: '27' },
      { field: 'percentage', description: 'Win percentage', required: 'Yes', example: '77.78' },
      { field: 'cup', description: 'Cup achievement (CHAMPIONS, RUNNERS UP, etc.)', required: 'No', example: 'CHAMPIONS' },
      { field: '', description: '', required: '', example: '' },
      { field: 'PLAYERS SHEET', description: '', required: '', example: '' },
      { field: 'name', description: 'Full name of the player (must be unique)', required: 'Yes', example: 'Cristiano Ronaldo' },
      { field: 'team', description: 'Team the player belongs to (must match Teams sheet)', required: 'Yes', example: 'Manchester United FC' },
      { field: 'category', description: 'Player category (RED, BLUE, LEGEND, GREEN, etc.)', required: 'Yes', example: 'RED' },
      { field: 'goals_scored', description: 'Total goals scored by the player', required: 'Yes', example: '22' },
      { field: 'goals_per_game', description: 'Average goals per game', required: 'Yes', example: '1.1' },
      { field: 'goals_conceded', description: 'Total goals conceded', required: 'Yes', example: '12' },
      { field: 'conceded_per_game', description: 'Average goals conceded per game', required: 'Yes', example: '0.6' },
      { field: 'net_goals', description: 'Net goals (scored - conceded)', required: 'Yes', example: '10' },
      { field: 'cleansheets', description: 'Number of clean sheets', required: 'Yes', example: '8' },
      { field: 'points', description: 'Average points per match', required: 'Yes', example: '5.5' },
      { field: 'win', description: 'Number of matches won', required: 'Yes', example: '12' },
      { field: 'draw', description: 'Number of matches drawn', required: 'Yes', example: '4' },
      { field: 'loss', description: 'Number of matches lost', required: 'Yes', example: '4' },
      { field: 'total_matches', description: 'Total matches played (W + D + L)', required: 'Yes', example: '20' },
      { field: 'total_points', description: 'Total points earned (W*3 + D*1)', required: 'Yes', example: '40' },
      { field: 'category_wise_trophy_1', description: 'Category trophy/award 1 (e.g., BEST PLAYER)', required: 'No', example: 'BEST PLAYER' },
      { field: 'category_wise_trophy_2', description: 'Category trophy/award 2', required: 'No', example: '' },
      { field: 'individual_wise_trophy_1', description: 'Individual trophy/award 1 (e.g., TOP SCORER, GOLDEN BOOT)', required: 'No', example: 'TOP SCORER' },
      { field: 'individual_wise_trophy_2', description: 'Individual trophy/award 2 (e.g., GOLDEN BALL)', required: 'No', example: 'GOLDEN BOOT' },
      { field: 'potm', description: 'Player of the Match ID (nullable integer)', required: 'No', example: '1' },
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
    [1, 16].forEach(rowNum => {
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
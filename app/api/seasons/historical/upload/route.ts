import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

// Types for the parsed data
interface ParsedTeam {
  team_name: string;
  owner_name: string;
}

interface ParsedPlayer {
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

interface ParsedSeasonData {
  teams: ParsedTeam[];
  players: ParsedPlayer[];
  errors: string[];
  warnings: string[];
}

// Validation functions
const validateTeam = (team: any, index: number): { team?: ParsedTeam; errors: string[] } => {
  const errors: string[] = [];
  
  if (!team.team_name || typeof team.team_name !== 'string' || !team.team_name.trim()) {
    errors.push(`Row ${index + 1}: Team name is required`);
  }
  
  if (!team.owner_name || typeof team.owner_name !== 'string' || !team.owner_name.trim()) {
    errors.push(`Row ${index + 1}: Owner name is required`);
  }
  
  if (errors.length > 0) return { errors };
  
  return {
    team: {
      team_name: team.team_name.trim(),
      owner_name: team.owner_name.trim(),
    },
    errors: []
  };
};

const validatePlayer = (player: any, index: number): { player?: ParsedPlayer; errors: string[] } => {
  const errors: string[] = [];
  
  // Required string fields
  if (!player.name || typeof player.name !== 'string' || !player.name.trim()) {
    errors.push(`Row ${index + 1}: Player name is required`);
  }
  
  if (!player.team || typeof player.team !== 'string' || !player.team.trim()) {
    errors.push(`Row ${index + 1}: Team is required`);
  }
  
  if (!player.category || typeof player.category !== 'string' || !player.category.trim()) {
    errors.push(`Row ${index + 1}: Category is required`);
  }
  
  // Required numeric fields
  const numericFields = [
    'goals_scored', 'goals_per_game', 'goals_conceded', 'conceded_per_game',
    'net_goals', 'cleansheets', 'points', 'win', 'draw', 'loss',
    'total_matches', 'total_points'
  ];
  
  const numericValues: any = {};
  
  numericFields.forEach(field => {
    const value = Number(player[field]);
    if (player[field] === undefined || player[field] === null || isNaN(value)) {
      errors.push(`Row ${index + 1}: ${field.replace('_', ' ')} must be a valid number`);
    } else if (field === 'total_matches' && value < 0) {
      errors.push(`Row ${index + 1}: Total matches cannot be negative`);
    } else if (['win', 'draw', 'loss'].includes(field) && value < 0) {
      errors.push(`Row ${index + 1}: ${field} cannot be negative (match results must be non-negative)`);
    } else {
      numericValues[field] = value;
    }
  });
  
  // Validate match math (win + draw + loss should equal total_matches)
  if (numericValues.win !== undefined && numericValues.draw !== undefined && 
      numericValues.loss !== undefined && numericValues.total_matches !== undefined) {
    const matchSum = numericValues.win + numericValues.draw + numericValues.loss;
    if (matchSum !== numericValues.total_matches) {
      errors.push(`Row ${index + 1}: Win + Draw + Loss (${matchSum}) should equal Total Matches (${numericValues.total_matches})`);
    }
  }
  
  if (errors.length > 0) return { errors };
  
  return {
    player: {
      name: player.name.trim(),
      team: player.team.trim(),
      category: player.category.trim(),
      goals_scored: numericValues.goals_scored,
      goals_per_game: numericValues.goals_per_game,
      goals_conceded: numericValues.goals_conceded,
      conceded_per_game: numericValues.conceded_per_game,
      net_goals: numericValues.net_goals,
      cleansheets: numericValues.cleansheets,
      points: numericValues.points,
      win: numericValues.win,
      draw: numericValues.draw,
      loss: numericValues.loss,
      total_matches: numericValues.total_matches,
      total_points: numericValues.total_points,
    },
    errors: []
  };
};


// Parse Excel file
async function parseExcelFile(buffer: ArrayBuffer): Promise<ParsedSeasonData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const result: ParsedSeasonData = {
    teams: [],
    players: [],
    errors: [],
    warnings: []
  };
  
  try {
    // Parse Teams sheet
    const teamsSheet = workbook.getWorksheet('Teams');
    if (teamsSheet) {
      const teamsData: any[] = [];
      teamsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        const rowData: any = {};
        row.eachCell((cell, colNumber) => {
          const header = teamsSheet.getRow(1).getCell(colNumber).value as string;
          rowData[header] = cell.value;
        });
        if (Object.keys(rowData).length > 0 && rowData.team_name) {
          teamsData.push(rowData);
        }
      });
      
      teamsData.forEach((team, index) => {
        const { team: validatedTeam, errors } = validateTeam(team, index);
        if (validatedTeam) result.teams.push(validatedTeam);
        result.errors.push(...errors.map(e => `Teams Sheet - ${e}`));
      });
    } else {
      result.errors.push('Teams sheet not found. Please ensure your Excel file has a sheet named "Teams".');
    }
    
    // Parse Players sheet
    const playersSheet = workbook.getWorksheet('Players');
    if (playersSheet) {
      const playersData: any[] = [];
      playersSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        const rowData: any = {};
        row.eachCell((cell, colNumber) => {
          const header = playersSheet.getRow(1).getCell(colNumber).value as string;
          rowData[header] = cell.value;
        });
        if (Object.keys(rowData).length > 0 && rowData.name) {
          playersData.push(rowData);
        }
      });
      
      playersData.forEach((player, index) => {
        const { player: validatedPlayer, errors } = validatePlayer(player, index);
        if (validatedPlayer) result.players.push(validatedPlayer);
        result.errors.push(...errors.map(e => `Players Sheet - ${e}`));
      });
    } else {
      result.errors.push('Players sheet not found. Please ensure your Excel file has a sheet named "Players".');
    }
    
  } catch (error: any) {
    result.errors.push(`Error parsing Excel file: ${error.message}`);
  }
  
  return result;
}

// Parse CSV file (basic implementation - assumes single sheet)
async function parseCSVFile(text: string): Promise<ParsedSeasonData> {
  return new Promise((resolve) => {
    Papa.parse(text, {
      header: true,
      complete: (results) => {
        const result: ParsedSeasonData = {
          teams: [],
          players: [],
          errors: [],
          warnings: ['CSV parsing is basic - consider using Excel format with multiple sheets for full functionality']
        };
        
        // For CSV, we'll try to detect the type based on headers
        const data = results.data as any[];
        
        data.forEach((row, index) => {
          if (row.name && row.team && row.category) {
            // Assume it's player data
            const { player: validatedPlayer, errors } = validatePlayer(row, index);
            if (validatedPlayer) result.players.push(validatedPlayer);
            result.errors.push(...errors);
          } else if (row.team_name && row.owner_name) {
            // Assume it's team data
            const { team: validatedTeam, errors } = validateTeam(row, index);
            if (validatedTeam) result.teams.push(validatedTeam);
            result.errors.push(...errors);
          }
        });
        
        resolve(result);
      },
      error: (error: any) => {
        resolve({
          teams: [],
          players: [],
          errors: [`CSV parsing error: ${error.message}`],
          warnings: []
        });
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const seasonName = formData.get('seasonName') as string;
    const seasonShortName = formData.get('seasonShortName') as string;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    if (!seasonName || !seasonShortName) {
      return NextResponse.json(
        { success: false, error: 'Season name and short name are required' },
        { status: 400 }
      );
    }
    
    // Check file type
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCSV = fileName.endsWith('.csv');
    
    if (!isExcel && !isCSV) {
      return NextResponse.json(
        { success: false, error: 'Only Excel (.xlsx, .xls) and CSV files are supported' },
        { status: 400 }
      );
    }
    
    let parsedData: ParsedSeasonData;
    
    if (isExcel) {
      const arrayBuffer = await file.arrayBuffer();
      parsedData = await parseExcelFile(arrayBuffer);
    } else {
      const text = await file.text();
      parsedData = await parseCSVFile(text);
    }
    
    // Add season information to the response
    const response = {
      success: true,
      data: {
        seasonInfo: {
          name: seasonName,
          shortName: seasonShortName,
          fileName: file.name,
          fileSize: file.size,
          fileType: isExcel ? 'excel' : 'csv'
        },
        ...parsedData,
        summary: {
          teamsCount: parsedData.teams.length,
          playersCount: parsedData.players.length,
          errorsCount: parsedData.errors.length,
          warningsCount: parsedData.warnings.length
        }
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Error processing file upload:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
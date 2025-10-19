import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

// Types for the parsed data
interface ParsedTeam {
  rank: number;
  team: string;
  owner_name: string;
  p: number; // Points
  mp: number; // Matches Played
  w: number; // Wins
  d: number; // Draws
  l: number; // Losses
  f: number; // Goals For
  a: number; // Goals Against
  gd: number; // Goal Difference
  percentage: number; // Win percentage
  cups?: string[]; // Multiple cup achievements (LEAGUE SHIELD, CUP, UCL, DUO CUP, UEL, UECL, etc.)
  linked_team_id?: string; // Optional: manually link to existing team (for name changes)
}

interface ParsedPlayer {
  name: string;
  team: string;
  category: string;
  goals_scored: number | null;
  goals_per_game: number | null;
  goals_conceded: number | null;
  conceded_per_game: number | null;
  net_goals: number | null;
  cleansheets: number | null;
  potm: number | null; // Player of the Match
  points: number | null;
  win: number;
  draw: number;
  loss: number;
  total_matches: number;
  total_points: number | null;
  // Trophy/Award fields (optional) - unlimited arrays
  category_trophies?: string[];
  individual_trophies?: string[];
}

interface ParsedSeasonData {
  teams: ParsedTeam[];
  players: ParsedPlayer[];
  errors: string[];
  warnings: string[];
}

// Validation functions
const validateTeam = (team: any, index: number): { team?: ParsedTeam; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required string fields
  if (!team.team || typeof team.team !== 'string' || !team.team.trim()) {
    errors.push(`Row ${index + 1}: Team name is required`);
  }
  
  if (!team.owner_name || typeof team.owner_name !== 'string' || !team.owner_name.trim()) {
    errors.push(`Row ${index + 1}: Owner name is required`);
  }
  
  // Required numeric fields
  const numericFields = ['rank', 'p', 'mp', 'w', 'd', 'l', 'f', 'a', 'gd', 'percentage'];
  const numericValues: any = {};
  
  numericFields.forEach(field => {
    let rawValue = team[field];
    // Trim whitespace if it's a string
    if (typeof rawValue === 'string') {
      rawValue = rawValue.trim();
    }
    const value = Number(rawValue);
    if (rawValue === undefined || rawValue === null || rawValue === '' || isNaN(value)) {
      errors.push(`Row ${index + 1}: ${field.toUpperCase()} must be a valid number`);
    } else {
      numericValues[field] = value;
    }
  });
  
  // Validate W + D + L = MP (WARNING only - matches can be nulled/voided)
  if (numericValues.w !== undefined && numericValues.d !== undefined && 
      numericValues.l !== undefined && numericValues.mp !== undefined) {
    const matchSum = numericValues.w + numericValues.d + numericValues.l;
    if (matchSum !== numericValues.mp) {
      warnings.push(`Row ${index + 1}: W + D + L (${matchSum}) does not equal MP (${numericValues.mp}). This may indicate nulled/voided matches.`);
    }
  }
  
  // Validate Goal Difference
  if (numericValues.f !== undefined && numericValues.a !== undefined && numericValues.gd !== undefined) {
    const calculatedGD = numericValues.f - numericValues.a;
    if (calculatedGD !== numericValues.gd) {
      errors.push(`Row ${index + 1}: GD (${numericValues.gd}) should equal F - A (${calculatedGD})`);
    }
  }
  
  if (errors.length > 0) return { errors, warnings };
  
  // Extract all cup columns dynamically (support unlimited cups)
  const cups: string[] = [];
  Object.keys(team).forEach(key => {
    const lowerKey = key.toLowerCase();
    const value = team[key];
    
    if (value && typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'null') {
      // Match cup columns: cup, cup_1, cup_2, Cup 1, Cup 2, etc.
      if (lowerKey.includes('cup') || lowerKey.includes('trophy') || lowerKey.includes('achievement')) {
        cups.push(value.trim());
      }
    }
  });
  
  return {
    team: {
      rank: numericValues.rank,
      team: team.team.trim(),
      owner_name: team.owner_name.trim(),
      p: numericValues.p,
      mp: numericValues.mp,
      w: numericValues.w,
      d: numericValues.d,
      l: numericValues.l,
      f: numericValues.f,
      a: numericValues.a,
      gd: numericValues.gd,
      percentage: numericValues.percentage,
      cups: cups.length > 0 ? cups : undefined,
    },
    errors: [],
    warnings
  };
};

const validatePlayer = (player: any, index: number): { player?: ParsedPlayer; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
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
  
  // Required numeric fields (these must always have values)
  const requiredNumericFields = ['win', 'draw', 'loss', 'total_matches'];
  
  // Optional numeric fields (can be null if data is missing)
  const optionalNumericFields = [
    'goals_scored', 'goals_per_game', 'goals_conceded', 'conceded_per_game',
    'net_goals', 'cleansheets', 'potm', 'points', 'total_points'
  ];
  
  const numericValues: any = {};
  
  // Validate required numeric fields
  requiredNumericFields.forEach(field => {
    let rawValue = player[field];
    // Trim whitespace if it's a string
    if (typeof rawValue === 'string') {
      rawValue = rawValue.trim();
    }
    const value = Number(rawValue);
    if (rawValue === undefined || rawValue === null || rawValue === '' || isNaN(value)) {
      errors.push(`Row ${index + 1}: ${field.replace('_', ' ')} is required`);
    } else if (value < 0) {
      errors.push(`Row ${index + 1}: ${field} cannot be negative`);
    } else {
      numericValues[field] = value;
    }
  });
  
  // Validate optional numeric fields (allow null/empty)
  optionalNumericFields.forEach(field => {
    let rawValue = player[field];
    // Trim whitespace if it's a string
    if (typeof rawValue === 'string') {
      rawValue = rawValue.trim();
    }
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      numericValues[field] = null; // Missing data = null
    } else {
      const value = Number(rawValue);
      if (isNaN(value)) {
        errors.push(`Row ${index + 1}: ${field.replace('_', ' ')} must be a valid number or empty`);
      } else {
        numericValues[field] = value;
      }
    }
  });
  
  // Validate match math (WARNING only - matches can be nulled/voided)
  if (numericValues.win !== undefined && numericValues.draw !== undefined && 
      numericValues.loss !== undefined && numericValues.total_matches !== undefined) {
    const matchSum = numericValues.win + numericValues.draw + numericValues.loss;
    if (matchSum !== numericValues.total_matches) {
      warnings.push(`Row ${index + 1}: Win (${numericValues.win}) + Draw (${numericValues.draw}) + Loss (${numericValues.loss}) = ${matchSum} does not equal Total Matches (${numericValues.total_matches}). This may indicate nulled/voided matches.`);
    }
  }
  
  if (errors.length > 0) return { errors, warnings };
  
  // Extract trophy/award fields (optional) - parse ALL trophy columns dynamically
  const categoryTrophies: string[] = [];
  const individualTrophies: string[] = [];
  
  // Check all possible column names for trophies
  Object.keys(player).forEach(key => {
    const lowerKey = key.toLowerCase();
    const value = player[key];
    
    if (value && typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'null') {
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
      potm: numericValues.potm,
      points: numericValues.points,
      win: numericValues.win,
      draw: numericValues.draw,
      loss: numericValues.loss,
      total_matches: numericValues.total_matches,
      total_points: numericValues.total_points,
      // Trophy arrays (support unlimited trophies)
      category_trophies: categoryTrophies,
      individual_trophies: individualTrophies
    },
    errors: [],
    warnings
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
      
      // Get all headers first
      const teamHeaders: string[] = [];
      const teamHeaderRow = teamsSheet.getRow(1);
      teamHeaderRow.eachCell((cell, colNumber) => {
        teamHeaders[colNumber] = cell.value as string;
      });
      
      teamsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        const rowData: any = {};
        
        // Process all columns, including empty ones
        teamHeaders.forEach((header, colNumber) => {
          if (header) {
            const cell = row.getCell(colNumber);
            let cellValue = cell.value;
            
            // Handle Excel formulas - get the calculated result
            if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
              cellValue = cellValue.result;
            }
            
            // Handle empty cells properly
            rowData[header] = (cellValue === null || cellValue === undefined) ? null : cellValue;
          }
        });
        
        if (Object.keys(rowData).length > 0 && (rowData.team || rowData.team_name)) {
          teamsData.push(rowData);
        }
      });
      
      teamsData.forEach((team, index) => {
        const { team: validatedTeam, errors, warnings } = validateTeam(team, index);
        if (validatedTeam) result.teams.push(validatedTeam);
        result.errors.push(...errors.map(e => `Teams Sheet - ${e}`));
        result.warnings.push(...warnings.map(w => `Teams Sheet - ${w}`));
      });
    } else {
      result.errors.push('Teams sheet not found. Please ensure your Excel file has a sheet named "Teams".');
    }
    
    // Parse Players sheet
    const playersSheet = workbook.getWorksheet('Players');
    if (playersSheet) {
      const playersData: any[] = [];
      
      // Get all headers first
      const headers: string[] = [];
      const headerRow = playersSheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value as string;
      });
      
      playersSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        const rowData: any = {};
        
        // Process all columns, including empty ones
        headers.forEach((header, colNumber) => {
          if (header) {
            const cell = row.getCell(colNumber);
            let cellValue = cell.value;
            
            // Handle Excel formulas - get the calculated result
            if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
              cellValue = cellValue.result;
            }
            
            // Handle empty cells properly
            rowData[header] = (cellValue === null || cellValue === undefined) ? null : cellValue;
          }
        });
        
        if (Object.keys(rowData).length > 0 && rowData.name) {
          playersData.push(rowData);
        }
      });
      
      playersData.forEach((player, index) => {
        const { player: validatedPlayer, errors, warnings } = validatePlayer(player, index);
        if (validatedPlayer) result.players.push(validatedPlayer);
        result.errors.push(...errors.map(e => `Players Sheet - ${e}`));
        result.warnings.push(...warnings.map(w => `Players Sheet - ${w}`));
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
            const { player: validatedPlayer, errors, warnings } = validatePlayer(row, index);
            if (validatedPlayer) result.players.push(validatedPlayer);
            result.errors.push(...errors);
            result.warnings.push(...warnings);
          } else if (row.team_name && row.owner_name) {
            // Assume it's team data
            const { team: validatedTeam, errors, warnings } = validateTeam(row, index);
            if (validatedTeam) result.teams.push(validatedTeam);
            result.errors.push(...errors);
            result.warnings.push(...warnings);
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
    const seasonNumber = formData.get('seasonNumber') as string;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    if (!seasonNumber || isNaN(parseInt(seasonNumber))) {
      return NextResponse.json(
        { success: false, error: 'Valid season number is required' },
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
    const seasonNum = parseInt(seasonNumber);
    const response = {
      success: true,
      data: {
        seasonInfo: {
          name: `Season ${seasonNum}`,
          shortName: `S${seasonNum}`,
          seasonNumber: seasonNum,
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
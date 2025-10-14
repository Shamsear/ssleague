import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file extension
    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'Only .db (SQLite database) files are supported' }, { status: 400 });
    }

    // Read the file as ArrayBuffer and convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    // Return the base64 encoded database for client-side processing
    return NextResponse.json({
      success: true,
      database: base64,
      filename: file.name
    });
  } catch (error: any) {
    console.error('Error reading SQLite database:', error);
    return NextResponse.json({ error: error.message || 'Failed to read SQLite database' }, { status: 500 });
  }
}

function parseSQLFile(sqlContent: string) {
  const players: any[] = [];
  
  // Match INSERT INTO statements
  const insertRegex = /INSERT INTO\s+`?(\w+)`?\s*\((.*?)\)\s*VALUES\s*\((.*?)\);/gi;
  
  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const columns = match[2].split(',').map(col => col.trim().replace(/`/g, ''));
    const valuesStr = match[3];
    
    // Parse individual value rows
    const valueRows = parseValueRows(valuesStr);
    
    valueRows.forEach(values => {
      if (values.length === columns.length) {
        const player: any = {};
        columns.forEach((col, idx) => {
          player[col] = parseValue(values[idx]);
        });
        players.push(player);
      }
    });
  }
  
  return players;
}

function parseValueRows(valuesStr: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inString = false;
  let stringChar = '';
  let depth = 0;
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    const nextChar = valuesStr[i + 1];
    
    if (!inString) {
      if (char === '(' && depth === 0) {
        // Start of new row
        currentRow = [];
        currentValue = '';
        depth++;
        continue;
      } else if (char === ')' && depth === 1) {
        // End of row
        if (currentValue.trim()) {
          currentRow.push(currentValue.trim());
        }
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        depth--;
        currentValue = '';
        continue;
      } else if (char === ',' && depth === 1) {
        // End of value
        currentRow.push(currentValue.trim());
        currentValue = '';
        continue;
      } else if ((char === '"' || char === "'") && depth === 1) {
        inString = true;
        stringChar = char;
        currentValue += char;
        continue;
      }
    } else {
      // Inside string
      if (char === '\\' && nextChar) {
        // Escaped character
        currentValue += char + nextChar;
        i++;
        continue;
      } else if (char === stringChar) {
        // End of string
        inString = false;
        currentValue += char;
        continue;
      }
    }
    
    if (depth >= 1) {
      currentValue += char;
    }
  }
  
  return rows;
}

function parseValue(value: string): any {
  value = value.trim();
  
  // NULL
  if (value.toUpperCase() === 'NULL') {
    return null;
  }
  
  // String (quoted)
  if ((value.startsWith("'") && value.endsWith("'")) || 
      (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  
  // Number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }
  
  // Boolean
  if (value.toUpperCase() === 'TRUE') return true;
  if (value.toUpperCase() === 'FALSE') return false;
  
  return value;
}

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Read file content
    const fileContent = await file.text()
    
    // Parse CSV
    const lines = fileContent.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      return NextResponse.json({ error: 'File is empty or invalid' }, { status: 400 })
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    
    // Find required column indices
    const playerIdIndex = headers.findIndex(h => 
      h.toLowerCase().includes('player') && h.toLowerCase().includes('id')
    )
    const nameIndex = headers.findIndex(h => 
      h.toLowerCase() === 'name'
    )
    const eligibleIndex = headers.findIndex(h => 
      h.toLowerCase().includes('eligible')
    )

    if (playerIdIndex === -1 || eligibleIndex === -1) {
      return NextResponse.json({ 
        error: 'Required columns not found. CSV must have "Player ID" and "Eligible" columns' 
      }, { status: 400 })
    }

    // Parse data rows
    const changes: Array<{ player_id: string; name: string; current_status: boolean; new_status: boolean }> = []
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i]
        if (!line.trim()) continue

        // Parse CSV line (handle quoted values)
        const values: string[] = []
        let currentValue = ''
        let insideQuotes = false

        for (let j = 0; j < line.length; j++) {
          const char = line[j]
          
          if (char === '"') {
            insideQuotes = !insideQuotes
          } else if (char === ',' && !insideQuotes) {
            values.push(currentValue.trim())
            currentValue = ''
          } else {
            currentValue += char
          }
        }
        values.push(currentValue.trim()) // Add last value

        const playerId = values[playerIdIndex]?.replace(/"/g, '')
        const name = nameIndex >= 0 ? values[nameIndex]?.replace(/"/g, '') : ''
        const eligibleValue = values[eligibleIndex]?.trim().replace(/"/g, '').toLowerCase()

        if (!playerId) {
          errors.push(`Row ${i + 1}: Missing player ID`)
          continue
        }

        // Parse eligible status
        const newStatus = eligibleValue === 'yes' || eligibleValue === 'true' || eligibleValue === '1'

        changes.push({
          player_id: playerId,
          name: name || playerId,
          current_status: false, // Will be filled in on preview page
          new_status: newStatus
        })
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      total_rows: lines.length - 1,
      changes_count: changes.length,
      errors_count: errors.length,
      changes,
      errors
    })
  } catch (error: any) {
    console.error('Error parsing file:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to parse file' 
    }, { status: 500 })
  }
}

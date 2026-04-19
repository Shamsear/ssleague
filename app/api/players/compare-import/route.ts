import { NextRequest, NextResponse } from 'next/server';
import { getAllPlayers } from '@/lib/neon/players';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newPlayers } = body;

    if (!newPlayers || !Array.isArray(newPlayers)) {
      return NextResponse.json(
        { success: false, error: 'newPlayers array is required' },
        { status: 400 }
      );
    }

    // Fetch all existing players from database
    const existingPlayers = await getAllPlayers();

    // Create a map of existing players by player_id for quick lookup
    const existingPlayersMap = new Map();
    existingPlayers.forEach((player: any) => {
      if (player.player_id) {
        existingPlayersMap.set(player.player_id.toString(), player);
      }
    });

    // Create a map of existing players by name (for duplicate detection)
    const existingPlayersByName = new Map<string, any[]>();
    existingPlayers.forEach((player: any) => {
      const normalizedName = player.name?.toLowerCase().trim();
      if (normalizedName) {
        if (!existingPlayersByName.has(normalizedName)) {
          existingPlayersByName.set(normalizedName, []);
        }
        existingPlayersByName.get(normalizedName)!.push(player);
      }
    });

    // Categorize players
    const toUpdate: any[] = [];
    const toCreate: any[] = [];
    const unchanged: any[] = [];
    const notFoundInNew: any[] = [];

    // Check which players will be updated or created
    newPlayers.forEach((newPlayer: any) => {
      const playerId = newPlayer.player_id?.toString();
      if (!playerId) return;

      const existing = existingPlayersMap.get(playerId);
      if (existing) {
        // Player exists - check if there are actual changes
        const normalizeValue = (val: any) => {
          if (val === null || val === undefined || val === '') return '';
          return String(val).trim();
        };

        const normalizeNumber = (val: any) => {
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        };

        // Debug: Log first player to see structure
        if (toUpdate.length === 0 && toCreate.length === 0) {
          console.log('🔍 DEBUG - First newPlayer structure:', {
            player_id: newPlayer.player_id,
            name: newPlayer.name,
            player_name: newPlayer.player_name,
            full_name: newPlayer.full_name,
            Name: newPlayer.Name,
            availableKeys: Object.keys(newPlayer).filter(k => k.toLowerCase().includes('name'))
          });
          console.log('🔍 DEBUG - Existing player structure:', {
            player_id: existing.player_id,
            name: existing.name,
            availableKeys: Object.keys(existing).filter(k => k.toLowerCase().includes('name'))
          });
        }

        const oldValues = {
          team_name: normalizeValue(existing.team_name || existing.club),
          position: normalizeValue(existing.position),
          playing_style: normalizeValue(existing.playing_style),
          overall_rating: normalizeNumber(existing.overall_rating),
          // All stats
          pace: normalizeNumber(existing.speed),
          shooting: normalizeNumber(existing.finishing),
          passing: normalizeNumber(existing.low_pass),
          dribbling: normalizeNumber(existing.dribbling),
          defending: normalizeNumber(existing.defensive_awareness),
          physical: normalizeNumber(existing.physical_contact),
          // Additional detailed stats
          acceleration: normalizeNumber(existing.acceleration),
          ball_control: normalizeNumber(existing.ball_control),
          tight_possession: normalizeNumber(existing.tight_possession),
          lofted_pass: normalizeNumber(existing.lofted_pass),
          heading: normalizeNumber(existing.heading),
          kicking_power: normalizeNumber(existing.kicking_power),
          jumping: normalizeNumber(existing.jumping),
          stamina: normalizeNumber(existing.stamina),
          tackling: normalizeNumber(existing.tackling),
          aggression: normalizeNumber(existing.aggression),
        };

        const newValues = {
          team_name: normalizeValue(newPlayer.team_name || newPlayer.club),
          position: normalizeValue(newPlayer.position),
          playing_style: normalizeValue(newPlayer.playing_style),
          overall_rating: normalizeNumber(newPlayer.overall_rating),
          // All stats
          pace: normalizeNumber(newPlayer.speed),
          shooting: normalizeNumber(newPlayer.finishing),
          passing: normalizeNumber(newPlayer.low_pass),
          dribbling: normalizeNumber(newPlayer.dribbling),
          defending: normalizeNumber(newPlayer.defensive_awareness),
          physical: normalizeNumber(newPlayer.physical_contact),
          // Additional detailed stats
          acceleration: normalizeNumber(newPlayer.acceleration),
          ball_control: normalizeNumber(newPlayer.ball_control),
          tight_possession: normalizeNumber(newPlayer.tight_possession),
          lofted_pass: normalizeNumber(newPlayer.lofted_pass),
          heading: normalizeNumber(newPlayer.heading),
          kicking_power: normalizeNumber(newPlayer.kicking_power),
          jumping: normalizeNumber(newPlayer.jumping),
          stamina: normalizeNumber(newPlayer.stamina),
          tackling: normalizeNumber(newPlayer.tackling),
          aggression: normalizeNumber(newPlayer.aggression),
        };

        // Check if any value has changed
        const hasChanges = 
          oldValues.team_name !== newValues.team_name ||
          oldValues.position !== newValues.position ||
          oldValues.playing_style !== newValues.playing_style ||
          oldValues.overall_rating !== newValues.overall_rating ||
          oldValues.pace !== newValues.pace ||
          oldValues.shooting !== newValues.shooting ||
          oldValues.passing !== newValues.passing ||
          oldValues.dribbling !== newValues.dribbling ||
          oldValues.defending !== newValues.defending ||
          oldValues.physical !== newValues.physical ||
          oldValues.acceleration !== newValues.acceleration ||
          oldValues.ball_control !== newValues.ball_control ||
          oldValues.tight_possession !== newValues.tight_possession ||
          oldValues.lofted_pass !== newValues.lofted_pass ||
          oldValues.heading !== newValues.heading ||
          oldValues.kicking_power !== newValues.kicking_power ||
          oldValues.jumping !== newValues.jumping ||
          oldValues.stamina !== newValues.stamina ||
          oldValues.tackling !== newValues.tackling ||
          oldValues.aggression !== newValues.aggression;

        // Only add to update list if there are actual changes
        if (hasChanges) {
          toUpdate.push({
            player_id: playerId,
            name: newPlayer.name || newPlayer.player_name || newPlayer.full_name || newPlayer.Name || `Player ${playerId}`,
            old: oldValues,
            new: newValues
          });
        } else {
          // No changes - add to unchanged list
          unchanged.push({
            player_id: playerId,
            name: newPlayer.name || newPlayer.player_name || newPlayer.full_name || newPlayer.Name || existing.name || `Player ${playerId}`,
            team_name: existing.team_name,
            position: existing.position,
            overall_rating: existing.overall_rating,
          });
        }
        
        // Mark as found (whether changed or not)
        existingPlayersMap.delete(playerId);
      } else {
        // Player doesn't exist - will be created
        const playerName = newPlayer.name || newPlayer.player_name || newPlayer.full_name || newPlayer.Name || `Player ${playerId}`;
        const normalizedName = playerName.toLowerCase().trim();
        
        // Check if a player with the same name already exists (potential duplicate)
        const duplicates = existingPlayersByName.get(normalizedName) || [];
        
        toCreate.push({
          player_id: playerId,
          name: playerName,
          team_name: newPlayer.team_name || newPlayer.club,
          position: newPlayer.position,
          playing_style: newPlayer.playing_style,
          overall_rating: newPlayer.overall_rating,
          pace: newPlayer.speed,
          shooting: newPlayer.finishing,
          passing: newPlayer.low_pass,
          dribbling: newPlayer.dribbling,
          defending: newPlayer.defensive_awareness,
          physical: newPlayer.physical_contact,
          // Add duplicate detection info
          hasDuplicates: duplicates.length > 0,
          duplicates: duplicates.map(dup => ({
            player_id: dup.player_id,
            name: dup.name,
            position: dup.position,
            overall_rating: dup.overall_rating,
            team_name: dup.team_name,
            team_id: dup.team_id,
            is_sold: dup.is_sold
          }))
        });
      }
    });

    // Remaining players in existingPlayersMap are not found in new data
    existingPlayersMap.forEach((player: any) => {
      notFoundInNew.push({
        player_id: player.player_id,
        name: player.name,
        team_name: player.team_name,
        team_id: player.team_id,
        position: player.position,
        overall_rating: player.overall_rating,
        is_sold: player.is_sold,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        toUpdate,
        toCreate,
        unchanged,
        notFoundInNew,
        summary: {
          totalExisting: existingPlayers.length,
          totalNew: newPlayers.length,
          willUpdate: toUpdate.length,
          willCreate: toCreate.length,
          unchanged: unchanged.length,
          notFound: notFoundInNew.length,
        }
      }
    });
  } catch (error: any) {
    console.error('Error comparing import data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

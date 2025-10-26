import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/fantasy/draft/prices?league_id=xxx
 * Get all player prices for a fantasy league
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'Missing league_id parameter' },
        { status: 400 }
      );
    }

    const sql = getFantasyDb();

    // Get all player prices
    const prices = await sql`
      SELECT 
        id,
        league_id as fantasy_league_id,
        player_id,
        player_name,
        real_team_id,
        real_team_name,
        star_rating,
        category,
        position,
        points,
        current_price,
        original_price,
        price_changes,
        current_ownership,
        owned_by_teams,
        created_at,
        updated_at
      FROM fantasy_player_prices
      WHERE league_id = ${league_id}
    `;

    return NextResponse.json({
      prices,
      total_count: prices.length,
    });
  } catch (error) {
    console.error('Error fetching player prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player prices', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/draft/prices
 * Set price for a single player OR generate prices for all players
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fantasy_league_id,
      season_id,
      player_id,
      price,
      pricing_model,
      generate_all,
    } = body;

    if (!fantasy_league_id || !season_id) {
      return NextResponse.json(
        { error: 'Missing required fields: fantasy_league_id, season_id' },
        { status: 400 }
      );
    }

    // Option 1: Set single player price
    if (player_id && price) {
      return await setSinglePlayerPrice({
        fantasy_league_id,
        player_id,
        price: parseInt(price),
      });
    }

    // Option 2: Generate prices for all players
    if (generate_all && pricing_model) {
      return await generateAllPrices({
        fantasy_league_id,
        season_id,
        pricing_model,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request: provide either (player_id + price) or (generate_all + pricing_model)' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error setting player prices:', error);
    return NextResponse.json(
      { error: 'Failed to set player prices', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Set price for a single player
async function setSinglePlayerPrice(params: {
  fantasy_league_id: string;
  player_id: string;
  price: number;
}) {
  const { fantasy_league_id, player_id, price } = params;
  const sql = getTournamentDb();
  const fantasySql = getFantasyDb();

  // Get player details from tournament DB
  const players = await sql`
    SELECT 
      player_id,
      name,
      team_id,
      star_rating,
      category
    FROM realplayer
    WHERE player_id = ${player_id}
    LIMIT 1
  `;

  if (players.length === 0) {
    return NextResponse.json(
      { error: 'Player not found' },
      { status: 404 }
    );
  }

  const playerData = players[0];

  // Check if price already exists
  const existingPrices = await fantasySql`
    SELECT id, current_price, price_changes
    FROM fantasy_player_prices
    WHERE league_id = ${fantasy_league_id}
      AND player_id = ${player_id}
    LIMIT 1
  `;

  if (existingPrices.length > 0) {
    // Update existing price
    const oldPrice = existingPrices[0];
    let priceChanges = oldPrice.price_changes || [];
    
    // Add to price history if price changed
    if (oldPrice.current_price !== price) {
      priceChanges = [
        ...priceChanges,
        {
          from_price: oldPrice.current_price,
          to_price: price,
          reason: 'admin_manual_update',
          changed_at: new Date().toISOString(),
        },
      ];
    }

    await fantasySql`
      UPDATE fantasy_player_prices
      SET 
        current_price = ${price},
        price_changes = ${JSON.stringify(priceChanges)},
        updated_at = NOW()
      WHERE id = ${oldPrice.id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Player price updated successfully',
      price_id: oldPrice.id,
      player_name: playerData.name,
      new_price: price,
    });
  } else {
    // Create new price
    const newPrices = await fantasySql`
      INSERT INTO fantasy_player_prices (
        league_id,
        player_id,
        player_name,
        real_team_id,
        star_rating,
        category,
        position,
        points,
        current_price,
        original_price,
        price_changes,
        current_ownership,
        owned_by_teams
      ) VALUES (
        ${fantasy_league_id},
        ${player_id},
        ${playerData.name},
        ${playerData.team_id || null},
        ${playerData.star_rating || 5},
        ${playerData.category || 'classic'},
        ${getPlayerPosition(playerData)},
        ${0},
        ${price},
        ${price},
        ${JSON.stringify([])},
        ${0},
        ${JSON.stringify([])}
      )
      RETURNING id
    `;

    return NextResponse.json({
      success: true,
      message: 'Player price created successfully',
      price_id: newPrices[0].id,
      player_name: playerData.name,
      price: price,
    });
  }
}

// Generate prices for all players based on pricing model
async function generateAllPrices(params: {
  fantasy_league_id: string;
  season_id: string;
  pricing_model: 'linear' | 'exponential' | 'tiered';
}) {
  const { fantasy_league_id, season_id, pricing_model } = params;
  const sql = getTournamentDb();
  const fantasySql = getFantasyDb();

  // Get all players for the season
  const players = await sql`
    SELECT 
      player_id,
      name,
      team_id,
      star_rating,
      category
    FROM realplayer
    WHERE season_id = ${season_id}
  `;

  if (players.length === 0) {
    return NextResponse.json(
      { error: 'No players found for this season' },
      { status: 404 }
    );
  }

  let pricesCreated = 0;

  for (const playerData of players) {
    const star_rating = playerData.star_rating || 5;
    
    // Calculate price based on model
    const price = calculatePrice(star_rating, pricing_model);

    // Upsert price (insert or update)
    await fantasySql`
      INSERT INTO fantasy_player_prices (
        league_id,
        player_id,
        player_name,
        real_team_id,
        star_rating,
        category,
        position,
        points,
        current_price,
        original_price,
        price_changes,
        current_ownership,
        owned_by_teams
      ) VALUES (
        ${fantasy_league_id},
        ${playerData.player_id},
        ${playerData.name},
        ${playerData.team_id || null},
        ${star_rating},
        ${playerData.category || 'classic'},
        ${getPlayerPosition(playerData)},
        ${0},
        ${price},
        ${price},
        ${JSON.stringify([])},
        ${0},
        ${JSON.stringify([])}
      )
      ON CONFLICT (league_id, player_id)
      DO UPDATE SET
        current_price = ${price},
        updated_at = NOW()
    `;

    pricesCreated++;
  }

  return NextResponse.json({
    success: true,
    message: `Generated prices for ${pricesCreated} players using ${pricing_model} model`,
    players_priced: pricesCreated,
    pricing_model,
  });
}

// Calculate price based on star rating and pricing model
function calculatePrice(stars: number, model: 'linear' | 'exponential' | 'tiered'): number {
  switch (model) {
    case 'linear':
      // €1M per star
      return stars * 1000000;

    case 'exponential':
      // €1M × (stars ^ 1.5)
      return Math.round(1000000 * Math.pow(stars, 1.5));

    case 'tiered':
      // Tiered pricing
      if (stars >= 9) return 15000000;  // €15M
      if (stars >= 7) return 10000000;  // €10M
      if (stars >= 5) return 7000000;   // €7M
      if (stars >= 3) return 4000000;   // €4M
      return 2000000;                    // €2M

    default:
      return stars * 1000000;
  }
}

// Get player position from realplayer data
function getPlayerPosition(playerData: any): string {
  // Try to extract position from various possible fields
  if (playerData.position) return playerData.position;
  
  // If no position, default based on some logic or return 'Unknown'
  return 'MID'; // Default
}

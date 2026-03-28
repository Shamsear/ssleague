import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { 
  generateDraftTiers, 
  type TierGenerationOptions 
} from '@/lib/fantasy/tier-generator';

/**
 * POST /api/fantasy/draft/generate-tiers/preview
 * Committee-only endpoint to preview tiered player lists before generation
 * 
 * This is a READ-ONLY preview that does NOT save to database
 * 
 * Request Body:
 * {
 *   league_id: string;
 *   draft_type: 'initial' | 'transfer';
 *   number_of_tiers: number;
 *   min_games_played?: number;
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   preview: {
 *     summary: {
 *       total_players: number;
 *       number_of_tiers: number;
 *       avg_players_per_tier: number;
 *       draft_type: string;
 *     };
 *     tiers: Array<{
 *       tier_id: string;
 *       tier_number: number;
 *       tier_name: string;
 *       players: Array<{
 *         real_player_id: string;
 *         player_name: string;
 *         position: string;
 *         real_team_name: string;
 *         total_points: number;
 *         games_played: number;
 *         avg_points_per_game: number;
 *       }>;
 *       player_count: number;
 *       min_points: number;
 *       max_points: number;
 *       avg_points: number;
 *     }>;
 *     warnings: Array<{
 *       type: string;
 *       severity: string;
 *       message: string;
 *     }>;
 *     can_generate: boolean;
 *   };
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify committee admin authorization
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { 
          success: false,
          error: auth.error || 'Unauthorized - Committee access required' 
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      league_id, 
      draft_type, 
      number_of_tiers,
      min_games_played 
    } = body;

    // Validate required parameters
    if (!league_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'league_id is required' 
        },
        { status: 400 }
      );
    }

    if (!draft_type) {
      return NextResponse.json(
        { 
          success: false,
          error: 'draft_type is required' 
        },
        { status: 400 }
      );
    }

    if (!['initial', 'transfer'].includes(draft_type)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'draft_type must be "initial" or "transfer"' 
        },
        { status: 400 }
      );
    }

    if (!number_of_tiers || number_of_tiers < 1) {
      return NextResponse.json(
        { 
          success: false,
          error: 'number_of_tiers must be a positive integer' 
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Previewing draft tiers for league: ${league_id}`);
    console.log(`   Draft type: ${draft_type}`);
    console.log(`   Number of tiers: ${number_of_tiers}`);
    console.log(`   Requested by: ${auth.userId} (${auth.role})`);

    // Generate tiers (preview only - not saved)
    const options: TierGenerationOptions = {
      leagueId: league_id,
      numberOfTiers: number_of_tiers,
      draftType: draft_type,
      minGamesPlayed: min_games_played !== undefined ? min_games_played : 3
    };

    let tiers;
    try {
      tiers = await generateDraftTiers(options);
    } catch (tierError) {
      console.error('❌ Error in generateDraftTiers:', tierError);
      throw new Error(`Tier generation failed: ${tierError instanceof Error ? tierError.message : 'Unknown error'}`);
    }

    // Calculate summary statistics
    const totalPlayers = tiers.reduce((sum, tier) => sum + tier.player_count, 0);
    const avgPlayersPerTier = totalPlayers / tiers.length;

    // Generate warnings
    const warnings: Array<{ type: string; severity: string; message: string }> = [];

    // Check for empty tiers
    const emptyTiers = tiers.filter(t => t.player_count === 0);
    if (emptyTiers.length > 0) {
      warnings.push({
        type: 'empty_tiers',
        severity: 'high',
        message: `${emptyTiers.length} tier(s) have no players. Consider reducing the number of tiers.`
      });
    }

    // Check for very small tiers
    const smallTiers = tiers.filter(t => t.player_count > 0 && t.player_count < 3);
    if (smallTiers.length > 0) {
      warnings.push({
        type: 'small_tiers',
        severity: 'medium',
        message: `${smallTiers.length} tier(s) have fewer than 3 players. This may limit bidding options.`
      });
    }

    // Check for unbalanced distribution
    const maxPlayers = Math.max(...tiers.map(t => t.player_count));
    const minPlayers = Math.min(...tiers.filter(t => t.player_count > 0).map(t => t.player_count));
    if (maxPlayers > minPlayers * 3) {
      warnings.push({
        type: 'unbalanced',
        severity: 'medium',
        message: 'Tier distribution is unbalanced. Some tiers have significantly more players than others.'
      });
    }

    // Check if we have enough players
    if (totalPlayers < number_of_tiers * 2) {
      warnings.push({
        type: 'insufficient_players',
        severity: 'critical',
        message: `Only ${totalPlayers} players available for ${number_of_tiers} tiers. Need at least ${number_of_tiers * 2} players.`
      });
    }

    // Determine if generation can proceed
    const canGenerate = !warnings.some(w => w.severity === 'critical');

    console.log(`✅ Preview generated: ${tiers.length} tiers, ${totalPlayers} players`);
    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} warning(s) detected`);
    }

    // Return preview data (NOT SAVED)
    return NextResponse.json({
      success: true,
      preview: {
        summary: {
          total_players: totalPlayers,
          number_of_tiers: tiers.length,
          avg_players_per_tier: Math.round(avgPlayersPerTier * 10) / 10,
          draft_type: draft_type
        },
        tiers: tiers.map(tier => ({
          tier_id: tier.tier_id,
          tier_number: tier.tier_number,
          tier_name: tier.tier_name,
          players: tier.players,
          player_count: tier.player_count,
          min_points: tier.min_points,
          max_points: tier.max_points,
          avg_points: tier.avg_points
        })),
        warnings,
        can_generate: canGenerate
      }
    });

  } catch (error) {
    console.error('❌ Error previewing draft tiers:', error);
    
    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to preview draft tiers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

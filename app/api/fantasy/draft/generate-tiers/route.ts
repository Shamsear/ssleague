import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { 
  generateDraftTiers, 
  saveTiersToDatabase,
  type TierGenerationOptions 
} from '@/lib/fantasy/tier-generator';

/**
 * POST /api/fantasy/draft/generate-tiers
 * Committee-only endpoint to generate tiered player lists for draft
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
 *   tiers: Array<{
 *     tier_id: string;
 *     tier_number: number;
 *     tier_name: string;
 *     players: Array<{
 *       real_player_id: string;
 *       player_name: string;
 *       position: string;
 *       real_team_name: string;
 *       total_points: number;
 *       games_played: number;
 *       avg_points_per_game: number;
 *     }>;
 *     player_count: number;
 *     min_points: number;
 *     max_points: number;
 *     avg_points: number;
 *   }>;
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

    console.log(`🎯 Generating draft tiers for league: ${league_id}`);
    console.log(`   Draft type: ${draft_type}`);
    console.log(`   Number of tiers: ${number_of_tiers}`);
    console.log(`   Requested by: ${auth.userId} (${auth.role})`);

    // Generate tiers
    const options: TierGenerationOptions = {
      leagueId: league_id,
      numberOfTiers: number_of_tiers,
      draftType: draft_type,
      minGamesPlayed: min_games_played
    };

    const tiers = await generateDraftTiers(options);

    // Save tiers to database
    await saveTiersToDatabase(league_id, tiers, draft_type);

    console.log(`✅ Successfully generated and saved ${tiers.length} tiers`);

    // Return tier data
    return NextResponse.json({
      success: true,
      message: `Successfully generated ${tiers.length} tiers`,
      tiers: tiers.map(tier => ({
        tier_id: tier.tier_id,
        tier_number: tier.tier_number,
        tier_name: tier.tier_name,
        players: tier.players,
        player_count: tier.player_count,
        min_points: tier.min_points,
        max_points: tier.max_points,
        avg_points: tier.avg_points
      }))
    });

  } catch (error) {
    console.error('❌ Error generating draft tiers:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate draft tiers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

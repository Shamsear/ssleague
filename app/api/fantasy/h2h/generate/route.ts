import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { 
  generateH2HFixtures, 
  h2hFixturesExist, 
  deleteH2HFixtures 
} from '@/lib/fantasy/h2h-generator';

/**
 * POST /api/fantasy/h2h/generate
 * Generate H2H fixtures for a specific round
 * 
 * Committee-only endpoint
 * 
 * Request Body:
 * {
 *   league_id: string;
 *   round_id: string;
 *   regenerate?: boolean; // If true, delete existing fixtures and regenerate
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   fixtures: Array<{
 *     fixture_id: string;
 *     team_a_id: string;
 *     team_b_id: string;
 *   }>;
 *   fixtures_count: number;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify committee authorization
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
    const { league_id, round_id, regenerate = false } = body;

    // Validate required parameters
    if (!league_id || !round_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameters: league_id, round_id' 
        },
        { status: 400 }
      );
    }

    console.log(`🎯 Generating H2H fixtures for league: ${league_id}, round: ${round_id}`);
    console.log(`   Requested by: ${auth.userId} (${auth.role})`);
    console.log(`   Regenerate: ${regenerate}`);

    // Check if fixtures already exist
    const fixturesExist = await h2hFixturesExist(league_id, round_id);

    if (fixturesExist && !regenerate) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Fixtures already exist for this round. Set regenerate=true to overwrite.' 
        },
        { status: 400 }
      );
    }

    // Delete existing fixtures if regenerating
    if (fixturesExist && regenerate) {
      console.log('🗑️ Deleting existing fixtures...');
      await deleteH2HFixtures(league_id, round_id);
    }

    // Generate new fixtures
    const fixtures = await generateH2HFixtures(league_id, round_id);

    console.log(`✅ Successfully generated ${fixtures.length} H2H fixtures`);

    return NextResponse.json({
      success: true,
      message: `Successfully generated ${fixtures.length} H2H fixtures`,
      fixtures: fixtures.map(f => ({
        fixture_id: f.fixture_id,
        team_a_id: f.team_a_id,
        team_b_id: f.team_b_id
      })),
      fixtures_count: fixtures.length
    });

  } catch (error: any) {
    console.error('❌ Error generating H2H fixtures:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate H2H fixtures',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

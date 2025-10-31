import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

interface StarRatingConfig {
  star_rating: number;
  starting_points: number;
  base_auction_value: number;
}

const DEFAULT_CONFIG: StarRatingConfig[] = [
  { star_rating: 3, starting_points: 100, base_auction_value: 100 },
  { star_rating: 4, starting_points: 120, base_auction_value: 120 },
  { star_rating: 5, starting_points: 145, base_auction_value: 150 },
  { star_rating: 6, starting_points: 175, base_auction_value: 180 },
  { star_rating: 7, starting_points: 210, base_auction_value: 220 },
  { star_rating: 8, starting_points: 250, base_auction_value: 270 },
  { star_rating: 9, starting_points: 300, base_auction_value: 330 },
  { star_rating: 10, starting_points: 350, base_auction_value: 400 },
];

/**
 * GET /api/star-rating-config?seasonId=SSPSLS16
 * Fetch star rating configuration for a season
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'seasonId is required' },
        { status: 400 }
      );
    }

    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();
    const config = seasonData?.star_rating_config || DEFAULT_CONFIG;

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error('Error fetching star rating config:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/star-rating-config
 * Update star rating configuration for a season
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seasonId, config } = body;

    if (!seasonId || !config) {
      return NextResponse.json(
        { success: false, error: 'seasonId and config are required' },
        { status: 400 }
      );
    }

    // Validate config
    if (!Array.isArray(config) || config.length !== 8) {
      return NextResponse.json(
        { success: false, error: 'Config must be an array of 8 items (3-10 stars)' },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of config) {
      if (
        typeof item.star_rating !== 'number' ||
        typeof item.starting_points !== 'number' ||
        typeof item.base_auction_value !== 'number' ||
        item.star_rating < 3 ||
        item.star_rating > 10 ||
        item.starting_points <= 0 ||
        item.base_auction_value <= 0
      ) {
        return NextResponse.json(
          { success: false, error: 'Invalid config format' },
          { status: 400 }
        );
      }
    }

    // Update season document
    await adminDb.collection('seasons').doc(seasonId).update({
      star_rating_config: config,
      updated_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Star rating configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating star rating config:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

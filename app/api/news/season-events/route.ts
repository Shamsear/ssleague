import { NextRequest, NextResponse } from 'next/server';
import { 
  generateSeasonCreatedNews, 
  generateSeasonActiveNews, 
  generateSeasonCompleteNews 
} from '@/lib/news/season-events';

/**
 * POST /api/news/season-events
 * Manually trigger news generation for season lifecycle events
 * Body: { event_type: 'created' | 'active' | 'complete', season_id: string, season_name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_type, season_id, season_name } = body;

    if (!event_type || !season_id || !season_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: event_type, season_id, season_name' },
        { status: 400 }
      );
    }

    let newsId: string | null = null;

    switch (event_type) {
      case 'created':
        newsId = await generateSeasonCreatedNews(season_id, season_name);
        break;
      case 'active':
        newsId = await generateSeasonActiveNews(season_id, season_name);
        break;
      case 'complete':
        newsId = await generateSeasonCompleteNews(season_id, season_name);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid event_type. Must be: created, active, or complete' },
          { status: 400 }
        );
    }

    if (!newsId) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate news' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Season ${event_type} news generated successfully`,
      news_id: newsId
    });
  } catch (error: any) {
    console.error('Error generating season event news:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate news' },
      { status: 500 }
    );
  }
}

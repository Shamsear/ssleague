import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { generateNewsContent, generateBilingualNews } from '@/lib/news/auto-generate';
import { NewsGenerationInput, NewsItem } from '@/lib/news/types';
import { generateNewsImage } from '@/lib/images/generate';

/**
 * GET /api/news
 * Fetch published news items (public endpoint)
 * Query params: season_id, category, limit
 */
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeDrafts = searchParams.get('include_drafts') === 'true';

    // Build SQL query with filters
    let query = sql`
      SELECT * FROM news
      WHERE 1=1
    `;

    // Add filters
    if (!includeDrafts) {
      query = sql`
        SELECT * FROM news
        WHERE is_published = true
      `;
    } else {
      query = sql`SELECT * FROM news WHERE 1=1`;
    }

    if (seasonId && category) {
      query = sql`
        SELECT * FROM news
        WHERE ${includeDrafts ? sql`1=1` : sql`is_published = true`}
          AND season_id = ${seasonId}
          AND category = ${category}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else if (seasonId) {
      query = sql`
        SELECT * FROM news
        WHERE ${includeDrafts ? sql`1=1` : sql`is_published = true`}
          AND season_id = ${seasonId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else if (category) {
      query = sql`
        SELECT * FROM news
        WHERE ${includeDrafts ? sql`1=1` : sql`is_published = true`}
          AND category = ${category}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql`
        SELECT * FROM news
        WHERE ${includeDrafts ? sql`1=1` : sql`is_published = true`}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    const newsItems = await query;

    return NextResponse.json({
      success: true,
      news: newsItems,
      count: newsItems.length,
    });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch news',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/news
 * Create or update news item
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      content,
      summary,
      category,
      event_type,
      season_id,
      season_name,
      is_published,
      metadata,
      image_url,
      generate_with_ai,
      generation_input,
    } = body;

    // If requesting AI generation
    if (generate_with_ai && generation_input) {
      try {
        // Generate bilingual content (English + Malayalam)
        const bilingualResult = await generateBilingualNews(generation_input as NewsGenerationInput);
        
        // Create draft news item with AI-generated content
        const sql = getTournamentDb();
        const newsId = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Generate image for the news (async, non-blocking)
        let imageUrl: string | null = null;
        try {
          console.log('🎨 Generating image for news...');
          imageUrl = await generateNewsImage(
            generation_input.event_type,
            generation_input.metadata || {},
            newsId
          );
          console.log(imageUrl ? '✅ Image generated!' : '⚠️ Image generation skipped');
        } catch (imageError) {
          console.error('Image generation failed (non-fatal):', imageError);
        }
        
        // Insert into Neon database with bilingual content
        await sql`
          INSERT INTO news (
            id, title_en, title_ml, content_en, content_ml, 
            summary_en, summary_ml, category, event_type,
            season_id, season_name, is_published, published_at,
            generated_by, edited_by_admin, metadata, image_url,
            tone, reporter_en, reporter_ml
          ) VALUES (
            ${newsId},
            ${bilingualResult.en.title},
            ${bilingualResult.ml.title},
            ${bilingualResult.en.content},
            ${bilingualResult.ml.content},
            ${bilingualResult.en.summary},
            ${bilingualResult.ml.summary},
            ${generation_input.category},
            ${generation_input.event_type},
            ${generation_input.season_id || null},
            ${generation_input.season_name || null},
            true,
            NOW(),
            'ai',
            false,
            ${JSON.stringify(generation_input.metadata || {})},
            ${imageUrl},
            ${bilingualResult.en.tone},
            ${bilingualResult.en.reporter},
            ${bilingualResult.ml.reporter}
          )
        `;

        const newsData = {
          id: newsId,
          title_en: bilingualResult.en.title,
          title_ml: bilingualResult.ml.title,
          content_en: bilingualResult.en.content,
          content_ml: bilingualResult.ml.content,
          summary_en: bilingualResult.en.summary,
          summary_ml: bilingualResult.ml.summary,
          category: generation_input.category,
          event_type: generation_input.event_type,
          season_id: generation_input.season_id || null,
          season_name: generation_input.season_name || null,
          is_published: true,
          generated_by: 'ai',
          edited_by_admin: false,
          metadata: generation_input.metadata || {},
          image_url: imageUrl,
          tone: bilingualResult.en.tone,
          reporter_en: bilingualResult.en.reporter,
          reporter_ml: bilingualResult.ml.reporter,
        };

        return NextResponse.json({
          success: true,
          message: 'Bilingual news generated with AI successfully',
          news_id: newsId,
          news: { id: newsId, ...newsData },
        });
      } catch (error: any) {
        console.error('Error generating bilingual news:', error);
        return NextResponse.json(
          {
            success: false,
            error: error.message || 'Failed to generate news with AI',
          },
          { status: 500 }
        );
      }
    }

    // Manual create/update
    if (!title || !content || !category || !event_type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: title, content, category, event_type',
        },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    if (id) {
      // Update existing
      await sql`
        UPDATE news SET
          title = ${title},
          content = ${content},
          summary = ${summary || null},
          category = ${category},
          event_type = ${event_type},
          season_id = ${season_id || null},
          season_name = ${season_name || null},
          is_published = ${is_published || false},
          ${is_published && sql`published_at = NOW(),`}
          metadata = ${JSON.stringify(metadata || {})},
          image_url = ${image_url || null},
          edited_by_admin = true,
          updated_at = NOW()
        WHERE id = ${id}
      `;

      return NextResponse.json({
        success: true,
        message: 'News updated successfully',
        news_id: id,
      });
    } else {
      // Create new
      const newsId = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await sql`
        INSERT INTO news (
          id, title, content, summary, category, event_type,
          season_id, season_name, is_published, generated_by,
          metadata, image_url
        ) VALUES (
          ${newsId},
          ${title},
          ${content},
          ${summary || null},
          ${category},
          ${event_type},
          ${season_id || null},
          ${season_name || null},
          ${is_published || false},
          'admin',
          ${JSON.stringify(metadata || {})},
          ${image_url || null}
        )
      `;

      return NextResponse.json({
        success: true,
        message: 'News created successfully',
        news_id: newsId,
      });
    }
  } catch (error: any) {
    console.error('Error creating/updating news:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create/update news',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/news?id=xxx
 * Delete news item
 * Requires admin authentication
 */
export async function DELETE(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing news ID',
        },
        { status: 400 }
      );
    }

    await sql`DELETE FROM news WHERE id = ${id}`;

    return NextResponse.json({
      success: true,
      message: 'News deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting news:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete news',
      },
      { status: 500 }
    );
  }
}

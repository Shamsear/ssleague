import { getTournamentDb } from '@/lib/neon/tournament-config';
import { generateBilingualNews } from './auto-generate';
import { generateNewsImage } from '../images/generate';
import { NewsGenerationInput } from './types';

/**
 * Auto-generate news when a season is created
 */
export async function generateSeasonCreatedNews(seasonId: string, seasonName: string): Promise<string | null> {
  try {
    console.log(`📰 Generating news for season creation: ${seasonName}`);
    
    const input: NewsGenerationInput = {
      event_type: 'season_start',
      category: 'announcement',
      season_id: seasonId,
      season_name: seasonName,
      metadata: {
        season_id: seasonId,
        season_name: seasonName,
        announcement_type: 'season_created'
      }
    };

    const bilingualResult = await generateBilingualNews(input);
    const sql = getTournamentDb();
    const newsId = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate image
    let imageUrl: string | null = null;
    try {
      imageUrl = await generateNewsImage('season_start', input.metadata || {}, newsId);
    } catch (error) {
      console.error('Image generation failed:', error);
    }

    // Insert news
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
        'announcement',
        'season_start',
        ${seasonId},
        ${seasonName},
        true,
        NOW(),
        'ai',
        false,
        ${JSON.stringify(input.metadata)},
        ${imageUrl},
        ${bilingualResult.en.tone},
        ${bilingualResult.en.reporter},
        ${bilingualResult.ml.reporter}
      )
    `;

    console.log(`✅ Season creation news generated: ${newsId}`);
    return newsId;
  } catch (error) {
    console.error('Error generating season creation news:', error);
    return null;
  }
}

/**
 * Auto-generate news when a season is set to active
 */
export async function generateSeasonActiveNews(seasonId: string, seasonName: string): Promise<string | null> {
  try {
    console.log(`📰 Generating news for season activation: ${seasonName}`);
    
    const sql = getTournamentDb();
    
    // Check if news already exists for this event
    const existing = await sql`
      SELECT id FROM news
      WHERE season_id = ${seasonId}
        AND event_type = 'season_start'
        AND metadata->>'announcement_type' = 'season_active'
    `;

    if (existing.length > 0) {
      console.log('Season active news already exists');
      return existing[0].id;
    }

    const input: NewsGenerationInput = {
      event_type: 'season_start',
      category: 'announcement',
      season_id: seasonId,
      season_name: seasonName,
      metadata: {
        season_id: seasonId,
        season_name: seasonName,
        announcement_type: 'season_active'
      }
    };

    const bilingualResult = await generateBilingualNews(input);
    const newsId = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate image
    let imageUrl: string | null = null;
    try {
      imageUrl = await generateNewsImage('season_start', input.metadata || {}, newsId);
    } catch (error) {
      console.error('Image generation failed:', error);
    }

    // Insert news
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
        'announcement',
        'season_start',
        ${seasonId},
        ${seasonName},
        true,
        NOW(),
        'ai',
        false,
        ${JSON.stringify(input.metadata)},
        ${imageUrl},
        ${bilingualResult.en.tone},
        ${bilingualResult.en.reporter},
        ${bilingualResult.ml.reporter}
      )
    `;

    console.log(`✅ Season active news generated: ${newsId}`);
    return newsId;
  } catch (error) {
    console.error('Error generating season active news:', error);
    return null;
  }
}

/**
 * Auto-generate news when a season is completed
 */
export async function generateSeasonCompleteNews(seasonId: string, seasonName: string): Promise<string | null> {
  try {
    console.log(`📰 Generating news for season completion: ${seasonName}`);
    
    const sql = getTournamentDb();
    
    // Check if news already exists
    const existing = await sql`
      SELECT id FROM news
      WHERE season_id = ${seasonId}
        AND event_type = 'season_complete'
    `;

    if (existing.length > 0) {
      console.log('Season complete news already exists');
      return existing[0].id;
    }

    // Get season statistics for the news
    const stats = await sql`
      SELECT 
        COUNT(DISTINCT team_id) as total_teams,
        COUNT(DISTINCT player_id) as total_players,
        COUNT(*) as total_matches
      FROM fixtures
      WHERE season_id = ${seasonId}
        AND status = 'completed'
    `;

    const input: NewsGenerationInput = {
      event_type: 'season_complete',
      category: 'announcement',
      season_id: seasonId,
      season_name: seasonName,
      metadata: {
        season_id: seasonId,
        season_name: seasonName,
        total_teams: stats[0]?.total_teams || 0,
        total_players: stats[0]?.total_players || 0,
        total_matches: stats[0]?.total_matches || 0
      }
    };

    const bilingualResult = await generateBilingualNews(input);
    const newsId = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate image
    let imageUrl: string | null = null;
    try {
      imageUrl = await generateNewsImage('season_complete', input.metadata || {}, newsId);
    } catch (error) {
      console.error('Image generation failed:', error);
    }

    // Insert news
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
        'announcement',
        'season_complete',
        ${seasonId},
        ${seasonName},
        true,
        NOW(),
        'ai',
        false,
        ${JSON.stringify(input.metadata)},
        ${imageUrl},
        ${bilingualResult.en.tone},
        ${bilingualResult.en.reporter},
        ${bilingualResult.ml.reporter}
      )
    `;

    console.log(`✅ Season complete news generated: ${newsId}`);
    return newsId;
  } catch (error) {
    console.error('Error generating season complete news:', error);
    return null;
  }
}

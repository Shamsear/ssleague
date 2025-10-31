import { getTournamentDb } from '@/lib/neon/tournament-config';
import { generateBilingualNews } from '@/lib/news/auto-generate';
import { NewsGenerationInput } from '@/lib/news/types';

/**
 * Generate news article when a major poll closes with results
 */
export async function generatePollResultsNews(pollId: string): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Fetch poll details
    const [poll] = await sql`
      SELECT 
        id, poll_type, question_en, question_ml,
        season_id, total_votes, metadata
      FROM polls
      WHERE id = ${pollId}
    `;
    
    if (!poll) {
      console.error('Poll not found:', pollId);
      return null;
    }
    
    // Only generate news for major poll types
    const majorPollTypes = [
      'season_champion',
      'season_mvp',
      'weekly_top_player',
      'weekly_top_team',
      'player_of_match',
    ];
    
    if (!majorPollTypes.includes(poll.poll_type)) {
      console.log('Skipping news generation for poll type:', poll.poll_type);
      return null;
    }
    
    // Get poll results
    const results = await sql`
      SELECT 
        po.id, po.text_en, po.text_ml,
        pr.vote_count, pr.percentage, pr.is_winner
      FROM poll_results pr
      JOIN poll_options po ON po.id = pr.option_id
      WHERE pr.poll_id = ${pollId}
      ORDER BY pr.vote_count DESC
    `;
    
    if (results.length === 0) {
      console.log('No results found for poll:', pollId);
      return null;
    }
    
    const winner = results.find((r: any) => r.is_winner);
    if (!winner) {
      console.log('No winner found for poll:', pollId);
      return null;
    }
    
    // Prepare news generation input based on poll type
    const newsInput = preparePollNewsInput(poll, winner, results);
    if (!newsInput) {
      return null;
    }
    
    console.log('🎰 Generating poll results news for:', pollId);
    
    // Generate bilingual news
    const bilingualResult = await generateBilingualNews(newsInput);
    
    // Save news to database
    const newsId = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await sql`
      INSERT INTO news (
        id, season_id, category, event_type,
        title_en, title_ml, content_en, content_ml,
        summary_en, summary_ml, tone,
        reporter_en, reporter_ml,
        is_published, published_at,
        generated_by, linked_poll_id,
        metadata, created_at
      ) VALUES (
        ${newsId},
        ${poll.season_id},
        'tournament',
        'poll_results',
        ${bilingualResult.en.title},
        ${bilingualResult.ml.title},
        ${bilingualResult.en.content},
        ${bilingualResult.ml.content},
        ${bilingualResult.en.summary},
        ${bilingualResult.ml.summary},
        ${bilingualResult.en.tone},
        ${bilingualResult.en.reporter},
        ${bilingualResult.ml.reporter},
        true,
        NOW(),
        'ai',
        ${pollId},
        ${JSON.stringify({
          poll_id: pollId,
          poll_type: poll.poll_type,
          total_votes: poll.total_votes,
          winner: winner.text_en,
        })},
        NOW()
      )
    `;
    
    console.log('✅ Poll results news created:', newsId);
    return newsId;
  } catch (error) {
    console.error('Error generating poll results news:', error);
    return null;
  }
}

/**
 * Prepare news generation input based on poll type
 */
function preparePollNewsInput(
  poll: any,
  winner: any,
  results: any[]
): NewsGenerationInput | null {
  const metadata: any = {
    poll_id: poll.id,
    total_votes: poll.total_votes,
    winner_text_en: winner.text_en,
    winner_text_ml: winner.text_ml,
    winner_percentage: winner.percentage,
    top_results: results.slice(0, 3).map((r: any) => ({
      text_en: r.text_en,
      text_ml: r.text_ml,
      votes: r.vote_count,
      percentage: r.percentage,
    })),
  };
  
  // Add poll-specific metadata
  if (poll.metadata) {
    const pollMeta = typeof poll.metadata === 'string' 
      ? JSON.parse(poll.metadata) 
      : poll.metadata;
    Object.assign(metadata, pollMeta);
  }
  
  switch (poll.poll_type) {
    case 'season_champion':
      return {
        event_type: 'poll_results',
        category: 'tournament',
        season_id: poll.season_id,
        metadata: {
          ...metadata,
          poll_question_en: poll.question_en,
          poll_question_ml: poll.question_ml,
          result_type: 'Season Champion Poll',
        },
      };
      
    case 'season_mvp':
      return {
        event_type: 'poll_results',
        category: 'player',
        season_id: poll.season_id,
        metadata: {
          ...metadata,
          poll_question_en: poll.question_en,
          poll_question_ml: poll.question_ml,
          result_type: 'Season MVP Poll',
        },
      };
      
    case 'weekly_top_player':
      return {
        event_type: 'poll_results',
        category: 'player',
        season_id: poll.season_id,
        metadata: {
          ...metadata,
          poll_question_en: poll.question_en,
          poll_question_ml: poll.question_ml,
          result_type: 'Weekly Top Player Poll',
          week_number: metadata.week_number,
        },
      };
      
    case 'weekly_top_team':
      return {
        event_type: 'poll_results',
        category: 'team',
        season_id: poll.season_id,
        metadata: {
          ...metadata,
          poll_question_en: poll.question_en,
          poll_question_ml: poll.question_ml,
          result_type: 'Weekly Top Team Poll',
          week_number: metadata.week_number,
        },
      };
      
    case 'player_of_match':
      return {
        event_type: 'poll_results',
        category: 'match',
        season_id: poll.season_id,
        metadata: {
          ...metadata,
          poll_question_en: poll.question_en,
          poll_question_ml: poll.question_ml,
          result_type: 'Player of the Match Poll',
          fixture_id: metadata.fixture_id,
        },
      };
      
    default:
      return null;
  }
}

/**
 * Check if a poll type should trigger news generation
 */
export function shouldGenerateNewsForPoll(pollType: string): boolean {
  const newsWorthyTypes = [
    'season_champion',
    'season_mvp',
    'weekly_top_player',
    'weekly_top_team',
    'player_of_match',
  ];
  
  return newsWorthyTypes.includes(pollType);
}

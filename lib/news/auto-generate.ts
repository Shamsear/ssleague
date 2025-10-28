import { getGeminiModel } from '../gemini/config';
import {
  NewsGenerationInput,
  NewsGenerationResult,
  NewsEventType,
} from './types';

// Prompt templates for different event types
const PROMPT_TEMPLATES: Record<NewsEventType, (input: NewsGenerationInput) => string> = {
  // Player Registration Events
  player_milestone: (input) => `
Generate an exciting news announcement for an eFootball esports tournament registration milestone.

Context:
- Season: ${input.season_name || 'Current Season'}
- Milestone: ${input.metadata.milestone_number || input.metadata.player_count} competitive eFootball players registered!
- Tournament: SS Premier Super League (eFootball/PES Esports Competition)

Requirements:
- Write an enthusiastic headline (under 80 characters)
- Create engaging content (2-3 paragraphs, ~150 words)
- Mention the player count milestone prominently
- Emphasize this is competitive eFootball/PES gaming tournament
- Encourage more esports competitors to register
- Keep tone energetic and welcoming to gamers
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  registration_phase_change: (input) => `
Generate a news announcement for a registration phase change.

Context:
- Season: ${input.season_name || 'Current Season'}
- Phase Change: From "${input.metadata.phase_from}" to "${input.metadata.phase_to}"
- Tournament: SS Premier Super League

Requirements:
- Write a clear, informative headline (under 80 characters)
- Explain what the phase change means for players (2 paragraphs, ~120 words)
- If moving to "unconfirmed" phase, explain waitlist concept
- If moving to "paused" or "closed", thank registrants and mention next steps
- Keep tone professional but friendly
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  confirmed_slots_filled: (input) => `
Generate an urgent news announcement that confirmed slots are filled.

Context:
- Season: ${input.season_name || 'Current Season'}
- Confirmed Slots: FULL
- Tournament: SS Premier Super League

Requirements:
- Write an attention-grabbing headline (under 80 characters)
- Announce that confirmed slots are filled (2 paragraphs, ~100 words)
- Mention if unconfirmed/waitlist registration is still open
- Keep tone urgent but not discouraging
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  // Team Events
  team_registered: (input) => `
Generate a news announcement for a team registration in an eFootball esports tournament.

Context:
- Season: ${input.season_name || 'Current Season'}
- Team Name: ${input.metadata.team_name}
- Team Status: ${input.metadata.is_returning ? 'RETURNING team (competed before)' : 'NEW team (first time competitor)'}
- Total Teams Registered: ${input.metadata.total_teams}
- Tournament: SS Premier Super League eFootball Tournament

Requirements:
- Write a ${input.metadata.is_returning ? 'welcoming back' : 'welcoming'} headline (under 80 characters)
- ${input.metadata.is_returning ? 'Welcome the returning team back and mention their experience' : 'Welcome the new team and build excitement for their debut'} (2 paragraphs, ~120 words)
- Mention this is an eFootball/PES competitive gaming tournament
- Build excitement for upcoming virtual soccer matches
- Keep tone ${input.metadata.is_returning ? 'celebratory and nostalgic' : 'enthusiastic and encouraging'}
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  team_players_assigned: (input) => `
Generate a news announcement for team player assignments after auction.

Context:
- Season: ${input.season_name || 'Current Season'}
- Team Name: ${input.metadata.team_name}
- Number of Players: ${input.metadata.player_ids?.length || 'Multiple'}
- Tournament: SS Premier Super League

Requirements:
- Write an exciting headline (under 80 characters)
- Announce the team roster is being built (2 paragraphs, ~120 words)
- Build anticipation for the tournament
- Keep tone exciting
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  team_roster_complete: (input) => `
Generate a news announcement for a complete team roster.

Context:
- Season: ${input.season_name || 'Current Season'}
- Team Name: ${input.metadata.team_name}
- Tournament: SS Premier Super League

Requirements:
- Write a celebratory headline (under 80 characters)
- Announce the team is ready for action (2 paragraphs, ~100 words)
- Build excitement for upcoming matches
- Keep tone celebratory
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  // Auction Events
  auction_scheduled: (input) => `
Generate an announcement that the auction is scheduled.

Context:
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League
${input.context ? `- Additional Info: ${input.context}` : ''}

Requirements:
- Write an exciting headline (under 80 characters)
- Announce the auction date/time (2-3 paragraphs, ~150 words)
- Build anticipation and excitement
- Keep tone energetic
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  auction_started: (input) => `
Generate a LIVE announcement that the auction has started.

Context:
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League

Requirements:
- Write an urgent, exciting headline with "LIVE" (under 80 characters)
- Announce the auction is happening NOW (1-2 paragraphs, ~80 words)
- Create FOMO (fear of missing out)
- Keep tone very energetic
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  auction_completed: (input) => `
Generate an announcement that the auction is complete.

Context:
- Season: ${input.season_name || 'Current Season'}
- Total Spent: ${input.metadata.total_spent ? `₹${input.metadata.total_spent}` : 'Significant amount'}
- Tournament: SS Premier Super League

Requirements:
- Write a celebratory headline (under 80 characters)
- Recap the auction success (2-3 paragraphs, ~150 words)
- Mention total amount if available
- Tease highlights or detailed results
- Keep tone celebratory
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  player_sold: (input) => `
Generate a quick announcement for a player being sold in auction.

Context:
- Player: ${input.metadata.player_name}
- Team: ${input.metadata.team_winning}
- Amount: ₹${input.metadata.winning_bid}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write a punchy headline (under 80 characters)
- Announce the sale (1 paragraph, ~60 words)
- Highlight the amount and team
- Keep tone exciting and brief
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  auction_highlights: (input) => `
Generate an auction highlights announcement.

Context:
- Season: ${input.season_name || 'Current Season'}
- Top Sales: ${input.metadata.highlights?.map((h: any) => `${h.player_name} to ${h.team_name} for ₹${h.amount}`).join(', ')}
- Tournament: SS Premier Super League

Requirements:
- Write an exciting headline (under 80 characters)
- Showcase the top auction moments (2-3 paragraphs, ~180 words)
- Highlight expensive buys and surprises
- Keep tone exciting and analytical
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  // Fantasy Events
  fantasy_opened: (input) => `
Generate an announcement that fantasy league is open.

Context:
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League

Requirements:
- Write an exciting headline (under 80 characters)
- Announce fantasy league is now open (2 paragraphs, ~120 words)
- Encourage participation
- Keep tone inviting and fun
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  fantasy_draft_complete: (input) => `
Generate an announcement that fantasy draft is complete.

Context:
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League

Requirements:
- Write a headline (under 80 characters)
- Announce draft completion (2 paragraphs, ~100 words)
- Wish participants good luck
- Keep tone friendly
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  fantasy_weekly_winner: (input) => `
Generate an announcement for weekly fantasy winner.

Context:
- Winner: ${input.metadata.winner_name}
- Score: ${input.metadata.winner_score}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write a celebratory headline (under 80 characters)
- Congratulate the winner (1-2 paragraphs, ~80 words)
- Mention their score
- Keep tone celebratory
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  fantasy_standings_update: (input) => `
Generate an update for fantasy league standings.

Context:
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League

Requirements:
- Write an informative headline (under 80 characters)
- Update on standings (2 paragraphs, ~100 words)
- Build excitement for remaining rounds
- Keep tone competitive
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  // Match Events
  match_scheduled: (input) => `
Generate an announcement for upcoming match.

Context:
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write an exciting headline (under 80 characters)
- Preview the match (2 paragraphs, ~120 words)
- Build anticipation
- Keep tone exciting
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  match_result: (input) => `
Generate a match result announcement.

Context:
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Score: ${input.metadata.home_score} - ${input.metadata.away_score}
- Winner: ${input.metadata.winner}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write a headline with result (under 80 characters)
- Report the match outcome (2 paragraphs, ~120 words)
- Highlight key moments if available
- Keep tone journalistic
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  player_of_match: (input) => `
Generate an announcement for player of the match.

Context:
- Player: ${input.metadata.player_of_match}
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write a celebratory headline (under 80 characters)
- Celebrate the player's performance (1-2 paragraphs, ~100 words)
- Keep tone celebratory
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  tournament_standings: (input) => `
Generate a tournament standings update.

Context:
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League

Requirements:
- Write an informative headline (under 80 characters)
- Update on current standings (2 paragraphs, ~120 words)
- Highlight top teams
- Keep tone analytical
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  semifinals_result: (input) => `
Generate a semifinals result announcement.

Context:
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Winner: ${input.metadata.winner}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write a dramatic headline (under 80 characters)
- Report the semifinal outcome (2-3 paragraphs, ~150 words)
- Build excitement for finals
- Keep tone dramatic
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  finals_result: (input) => `
Generate a FINALS result announcement.

Context:
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Winner: ${input.metadata.winner}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write a MAJOR headline celebrating the champion (under 80 characters)
- Report the final match (3 paragraphs, ~200 words)
- Celebrate the champions
- Thank all participants
- Keep tone celebratory and grand
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  // Season Events
  season_launched: (input) => `
Generate a season launch announcement.

Context:
- Season: ${input.season_name || 'New Season'}
- Tournament: SS Premier Super League

Requirements:
- Write a MAJOR launch headline (under 80 characters)
- Announce the new season (3 paragraphs, ~200 words)
- Build massive excitement
- Outline what's coming (registration, auction, matches)
- Keep tone very exciting
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  season_winner: (input) => `
Generate a season winner announcement.

Context:
- Champion: ${input.metadata.winner || input.metadata.team_name}
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League

Requirements:
- Write a CHAMPION headline (under 80 characters)
- Celebrate the season winner (3 paragraphs, ~200 words)
- Recap the season
- Thank everyone
- Keep tone celebratory and conclusive
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  // Manual
  manual: (input) => `
Generate a general tournament news announcement.

Context:
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League
- Additional Context: ${input.context || 'General announcement'}

Requirements:
- Write an appropriate headline (under 80 characters)
- Create informative content (2-3 paragraphs, ~150 words)
- Match the tone to the context
- Include a short summary (1 sentence, under 100 characters)

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,
};

/**
 * Generate news content using Gemini AI
 */
export async function generateNewsContent(
  input: NewsGenerationInput
): Promise<NewsGenerationResult> {
  try {
    console.log('🤖 Starting news generation:', {
      event_type: input.event_type,
      category: input.category,
      has_metadata: !!input.metadata,
    });
    
    const model = getGeminiModel();
    console.log('✅ Gemini model initialized');
    
    // Get the appropriate prompt template
    const promptTemplate = PROMPT_TEMPLATES[input.event_type];
    if (!promptTemplate) {
      console.error('❌ No prompt template for:', input.event_type);
      return {
        success: false,
        error: `No prompt template found for event type: ${input.event_type}`,
      };
    }

    const prompt = promptTemplate(input);
    console.log('📝 Prompt generated, length:', prompt.length);
    
    // Generate content
    console.log('🔄 Calling Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log('✅ Gemini response received, length:', text.length);
    console.log('📄 Response preview:', text.substring(0, 300));

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Failed to parse AI response as JSON',
      };
    }

    // Clean up the JSON string to handle control characters
    let jsonString = jsonMatch[0];
    
    // Replace problematic control characters in the JSON values
    // This regex finds string values and replaces control chars within them
    try {
      // First attempt: direct parse
      const generated = JSON.parse(jsonString);
      
      return {
        success: true,
        title: generated.title,
        content: generated.content,
        summary: generated.summary,
      };
    } catch (firstError) {
      // Second attempt: clean control characters
      try {
        // Remove or escape control characters (keep \n for newlines)
        jsonString = jsonString
          .replace(/\r\n/g, '\\n')  // Windows newlines
          .replace(/\n/g, '\\n')     // Unix newlines
          .replace(/\r/g, '\\n')     // Mac newlines
          .replace(/\t/g, '\\t')     // Tabs
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Other control chars
        
        const generated = JSON.parse(jsonString);
        
        return {
          success: true,
          title: generated.title,
          content: generated.content,
          summary: generated.summary,
        };
      } catch (secondError) {
        console.error('JSON parsing failed:', {
          original: jsonMatch[0].substring(0, 200),
          cleaned: jsonString.substring(0, 200),
          firstError: firstError instanceof Error ? firstError.message : firstError,
          secondError: secondError instanceof Error ? secondError.message : secondError,
        });
        
        return {
          success: false,
          error: `Failed to parse AI response: ${secondError instanceof Error ? secondError.message : 'Unknown error'}`,
        };
      }
    }
  } catch (error: any) {
    console.error('Error generating news content:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate news content',
    };
  }
}

import { getGeminiModel } from '../gemini/config';
import {
  NewsGenerationInput,
  NewsGenerationResult,
  NewsEventType,
  NewsLanguage,
  REPORTERS,
} from './types';
import { generatePrompt } from './prompts-bilingual';
import { determineTone } from './determine-tone';

// Prompt templates for different event types
const PROMPT_TEMPLATES: Record<NewsEventType, (input: NewsGenerationInput) => string> = {
  // Player Registration Events
  player_milestone: (input) => `
Generate a sports news article reporting on a tournament registration milestone.

Context:
- Season: ${input.season_name || 'Current Season'}
- Milestone: ${input.metadata.milestone_number || input.metadata.player_count} competitive eFootball players registered!
- Tournament: SS Premier Super League (eFootball/PES Esports Competition)

Requirements:
- Write as a sports JOURNALIST/REPORTER covering esports news (third-person perspective)
- Write an enthusiastic headline (under 80 characters)
- PARAGRAPH 1: Report the milestone achievement, mention player count
- PARAGRAPH 2: Provide context about the tournament and what this means for competition quality
- Optionally include a quote from tournament organizers
- Write in NEWS REPORTING STYLE, not as tournament organizers speaking
- Keep tone energetic and professional (2-3 paragraphs, ~150 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "The SS Premier Super League has reached a major milestone with ${input.metadata.player_count} players registered for the upcoming season..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  registration_phase_change: (input) => `
Generate a sports news article reporting on tournament registration phase change.

Context:
- Season: ${input.season_name || 'Current Season'}
- Phase Change: From "${input.metadata.phase_from}" to "${input.metadata.phase_to}"
- Tournament: SS Premier Super League

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write a clear, informative headline (under 80 characters)
- PARAGRAPH 1: Report the phase change and what it means
- PARAGRAPH 2: Explain implications for players (waitlist, next steps, etc.)
- Optionally include a brief statement from tournament organizers
- Write in NEWS REPORTING STYLE
- Keep tone professional and informative (2 paragraphs, ~120 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "The SS Premier Super League registration has transitioned to the ${input.metadata.phase_to} phase, tournament officials announced..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,


  // Team Events

  team_players_assigned: (input) => `
Generate a sports news article reporting on team player assignments.

Context:
- Season: ${input.season_name || 'Current Season'}
- Team Name: ${input.metadata.team_name}
- Number of Players: ${input.metadata.player_count || input.metadata.player_ids?.length || 'Multiple'}
- Total Spent: $${input.metadata.total_spent || 'Amount'}
- Remaining Budget: $${input.metadata.remaining_budget || 'Unknown'}
- Tournament: SS Premier Super League
${input.context ? `
Detailed Info:
${input.context}` : ''}

Requirements:
- Write as a sports JOURNALIST/REPORTER covering the news (third-person perspective)
- Write an exciting headline (under 80 characters)
- PARAGRAPH 1: Report that the team has assigned players to their roster, mention count and total investment
- PARAGRAPH 2: Name 2-3 key signings with star ratings and values if available
- Include budget information (total spent, remaining budget)
- Write in NEWS REPORTING STYLE, not as the team speaking
- Optionally include a brief manager quote about roster building strategy
- Build anticipation for upcoming matches (2-3 paragraphs, ~150 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "${input.metadata.team_name} have made significant moves in the transfer market, securing ${input.metadata.player_count} players for a combined $${input.metadata.total_spent}..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  team_roster_complete: (input) => `
Generate a sports news article reporting on a team's complete roster.

Context:
- Season: ${input.season_name || 'Current Season'}
- Team Name: ${input.metadata.team_name}
- Number of Players: ${input.metadata.player_count || 'Full Squad'}
- Total Spent: $${input.metadata.total_spent || 'Amount'}
- Starting Budget: $${input.metadata.starting_budget || 'Initial'}
- Remaining Budget: $${input.metadata.remaining_budget || 'Balance'}
- Tournament: SS Premier Super League
${input.context ? `
Detailed Roster Info:
${input.context}` : ''}

Requirements:
- Write as a sports JOURNALIST/REPORTER covering the news (third-person perspective)
- Write a celebratory headline (under 80 characters)
- PARAGRAPH 1: Lead - Report that the team has finalized their roster, mention total spent and player count
- PARAGRAPH 2: Details - List 2-3 key signings with their star ratings and values. Report objectively about the squad composition
- PARAGRAPH 3: Quote/Analysis - Include a brief quote from the team manager/owner expressing confidence, OR provide brief analysis of the roster strength
- Mention budget details (total investment, remaining budget)
- Write in NEWS REPORTING STYLE, not as if the team is speaking
- Keep tone professional and journalistic (2-3 paragraphs, ~180 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "The Red Panthers have completed their Season 16 roster, securing five SS Members for $290. Team manager expressed confidence in the squad's potential..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  // Auction Events
  auction_scheduled: (input) => `
Generate a sports news article reporting on scheduled auction.

Context:
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League
${input.context ? `- Additional Info: ${input.context}` : ''}

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write an exciting headline (under 80 characters)
- PARAGRAPH 1: Report that the auction has been scheduled, mention date/time
- PARAGRAPH 2: Provide context about what teams will be bidding for
- Optionally include quote from tournament organizers
- Write in NEWS REPORTING STYLE
- Build anticipation (2-3 paragraphs, ~150 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "The SS Premier Super League auction has been scheduled for [date], tournament officials announced today..."

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
Generate a sports news article reporting on completed auction.

Context:
- Season: ${input.season_name || 'Current Season'}
- Total Spent: ${input.metadata.total_spent ? `₹${input.metadata.total_spent}` : 'Significant amount'}
- Tournament: SS Premier Super League

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write a celebratory headline (under 80 characters)
- PARAGRAPH 1: Report that the auction has concluded, mention total spent
- PARAGRAPH 2: Provide highlights and standout moments
- PARAGRAPH 3: Include reaction quote from an official or analyst
- Write in NEWS REPORTING STYLE
- Keep tone celebratory and analytical (2-3 paragraphs, ~150 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "The SS Premier Super League auction concluded today with teams spending a combined ₹X million on players..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  player_sold: (input) => `
Generate a sports news flash for a player auction sale.

Context:
- Player: ${input.metadata.player_name}
- Team: ${input.metadata.team_winning}
- Amount: ₹${input.metadata.winning_bid}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write a punchy headline (under 80 characters)
- Report the sale briefly - who bought whom for how much (1 paragraph, ~60 words)
- Write in NEWS REPORTING STYLE, not as the team or auction speaking
- Keep tone exciting and brief
- Include a short summary (1 sentence, under 100 characters)

Example style: "${input.metadata.team_winning} have secured ${input.metadata.player_name} for ₹${input.metadata.winning_bid} in today's auction..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  auction_highlights: (input) => `
Generate a sports news article analyzing auction highlights.

Context:
- Season: ${input.season_name || 'Current Season'}
- Top Sales: ${input.metadata.highlights?.map((h: any) => `${h.player_name} to ${h.team_name} for ₹${h.amount}`).join(', ')}
- Tournament: SS Premier Super League

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write an exciting headline (under 80 characters)
- PARAGRAPH 1: Lead with the most expensive or surprising sale
- PARAGRAPH 2: Report on other notable transactions
- PARAGRAPH 3: Analysis of bidding patterns or expert opinion
- Write in NEWS REPORTING STYLE with analytical tone
- Keep tone exciting and analytical (2-3 paragraphs, ~180 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "The SS Premier Super League auction produced several blockbuster signings, with [player] commanding the highest bid of ₹X..."

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
Generate a sports news article previewing an upcoming match.

Context:
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write an exciting headline (under 80 characters)
- PARAGRAPH 1: Report the upcoming fixture details
- PARAGRAPH 2: Preview team form, key players, or rivalry context
- Write in NEWS REPORTING STYLE
- Build anticipation (2 paragraphs, ~120 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "${input.metadata.home_team} will face ${input.metadata.away_team} in what promises to be an exciting encounter..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  match_result: (input) => `
Generate a sports news match report.

Context:
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Score: ${input.metadata.home_score} - ${input.metadata.away_score}
- Winner: ${input.metadata.winner}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write a headline with result (under 80 characters)
- PARAGRAPH 1: Report the final score and winner
- PARAGRAPH 2: Describe key moments or standout performances
- Optionally include post-match quote from player or manager
- Write in NEWS REPORTING STYLE
- Keep tone journalistic and objective (2 paragraphs, ~120 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "${input.metadata.winner} secured a ${input.metadata.home_score}-${input.metadata.away_score} victory over ${input.metadata.home_team === input.metadata.winner ? input.metadata.away_team : input.metadata.home_team} in today's clash..."

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
Generate a sports news report on semifinals result.

Context:
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Winner: ${input.metadata.winner}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write a dramatic headline (under 80 characters)
- PARAGRAPH 1: Report the semifinal result
- PARAGRAPH 2: Describe the match drama and key moments
- PARAGRAPH 3: Look ahead to the finals and quote from winner
- Write in NEWS REPORTING STYLE
- Keep tone dramatic and exciting (2-3 paragraphs, ~150 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "${input.metadata.winner} have booked their place in the finals after defeating ${input.metadata.home_team === input.metadata.winner ? input.metadata.away_team : input.metadata.home_team} in a thrilling semifinal..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  finals_result: (input) => `
Generate a sports news report on the championship finals.

Context:
- Match: ${input.metadata.home_team} vs ${input.metadata.away_team}
- Winner: ${input.metadata.winner}
- Season: ${input.season_name || 'Current Season'}

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write a MAJOR headline celebrating the champion (under 80 characters)
- PARAGRAPH 1: Report the finals result and crowning of champions
- PARAGRAPH 2: Describe the championship-deciding moments
- PARAGRAPH 3: Include celebration quotes from champions and acknowledge runners-up
- Write in NEWS REPORTING STYLE
- Keep tone celebratory and grand (3 paragraphs, ~200 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "${input.metadata.winner} are the new SS Premier Super League champions after defeating ${input.metadata.home_team === input.metadata.winner ? input.metadata.away_team : input.metadata.home_team} in a thrilling final..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  // Season Events
  season_launched: (input) => `
Generate a sports news article announcing new season launch.

Context:
- Season: ${input.season_name || 'New Season'}
- Tournament: SS Premier Super League

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write a MAJOR launch headline (under 80 characters)
- PARAGRAPH 1: Report the official launch of the new season
- PARAGRAPH 2: Outline key dates and what's coming (registration, auction, matches)
- PARAGRAPH 3: Include quote from tournament organizers and build anticipation
- Write in NEWS REPORTING STYLE
- Keep tone very exciting and professional (3 paragraphs, ~200 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "The SS Premier Super League has officially launched its ${input.season_name}, marking the return of competitive eFootball action, organizers announced today..."

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}
`,

  season_winner: (input) => `
Generate a sports news article announcing season champions.

Context:
- Champion: ${input.metadata.winner || input.metadata.team_name}
- Season: ${input.season_name || 'Current Season'}
- Tournament: SS Premier Super League

Requirements:
- Write as a sports JOURNALIST/REPORTER (third-person perspective)
- Write a CHAMPION headline (under 80 characters)
- PARAGRAPH 1: Report the crowning of season champions
- PARAGRAPH 2: Recap their journey and key victories throughout the season
- PARAGRAPH 3: Include celebration quotes from champions and thank all participants
- Write in NEWS REPORTING STYLE
- Keep tone celebratory and conclusive (3 paragraphs, ~200 words)
- Include a short summary (1 sentence, under 100 characters)

Example style: "${input.metadata.winner || input.metadata.team_name} have been crowned ${input.season_name} champions, capping off a dominant campaign in the SS Premier Super League..."

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
 * Generate news content in both languages (NEW BILINGUAL VERSION)
 */
export async function generateBilingualNews(
  input: NewsGenerationInput
): Promise<{
  en: NewsGenerationResult & { tone: string; reporter: string };
  ml: NewsGenerationResult & { tone: string; reporter: string };
}> {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 2000;
  
  try {
    const tone = determineTone(input);
    console.log('🤖 Starting BILINGUAL news generation:', {
      event_type: input.event_type,
      category: input.category,
      tone: tone,
      languages: ['en', 'ml'],
    });
    
    const model = getGeminiModel();
    
    // Generate English version
    const enPrompt = generatePrompt(input, 'en');
    console.log('📝 EN prompt generated, length:', enPrompt.length);
    
    let enResult: NewsGenerationResult | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔄 Calling Gemini for English... (${attempt}/${MAX_RETRIES})`);
        const result = await model.generateContent(enPrompt);
        const text = result.response.text();
        enResult = await parseGeminiResponse(text);
        if (enResult.success) break;
      } catch (error: any) {
        if (attempt === MAX_RETRIES) throw error;
        await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY * Math.pow(2, attempt - 1)));
      }
    }
    
    if (!enResult?.success) {
      throw new Error('Failed to generate English content');
    }
    
    // Generate Malayalam version
    const mlPrompt = generatePrompt(input, 'ml');
    console.log('📝 ML prompt generated, length:', mlPrompt.length);
    
    let mlResult: NewsGenerationResult | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔄 Calling Gemini for Malayalam... (${attempt}/${MAX_RETRIES})`);
        const result = await model.generateContent(mlPrompt);
        const text = result.response.text();
        mlResult = await parseGeminiResponse(text);
        if (mlResult.success) break;
      } catch (error: any) {
        if (attempt === MAX_RETRIES) throw error;
        await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY * Math.pow(2, attempt - 1)));
      }
    }
    
    if (!mlResult?.success) {
      throw new Error('Failed to generate Malayalam content');
    }
    
    console.log('✅ Bilingual generation complete!');
    
    return {
      en: {
        ...enResult,
        tone: tone,
        reporter: REPORTERS.en.name_en,
      },
      ml: {
        ...mlResult,
        tone: tone,
        reporter: REPORTERS.ml.name_ml,
      },
    };
  } catch (error: any) {
    console.error('Error generating bilingual news:', error);
    throw error;
  }
}

/**
 * Generate news content using Gemini AI (LEGACY - for backward compatibility)
 */
export async function generateNewsContent(
  input: NewsGenerationInput
): Promise<NewsGenerationResult> {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 2000; // 2 seconds
  
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
    
    // Generate content with retry logic
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔄 Calling Gemini API... (attempt ${attempt}/${MAX_RETRIES})`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log('✅ Gemini response received, length:', text.length);
        console.log('📄 Response preview:', text.substring(0, 300));
        
        // If successful, break out and continue with parsing
        lastError = null;
        
        // Parse and return the result
        return await parseGeminiResponse(text);
      } catch (error: any) {
        lastError = error;
        const is503 = error.message?.includes('503') || error.message?.includes('overloaded');
        
        if (is503 && attempt < MAX_RETRIES) {
          const delay = INITIAL_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`⚠️ Gemini API overloaded (503), retrying in ${delay}ms... (attempt ${attempt}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If not 503 or last attempt, throw
        throw error;
      }
    }
    
    // If we exhausted retries
    throw lastError || new Error('Failed after all retry attempts');

  } catch (error: any) {
    console.error('Error generating news content:', error);
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to generate news content';
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      errorMessage = 'Gemini API is currently overloaded. Please try again in a few minutes.';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Parse Gemini response text into structured result
 */
async function parseGeminiResponse(text: string): Promise<NewsGenerationResult> {
  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      success: false,
      error: 'Failed to parse AI response as JSON',
    };
  }

  let jsonString = jsonMatch[0];
  
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
    // Second attempt: more aggressive cleaning
    try {
      // Extract fields manually if JSON.parse fails
      const titleMatch = jsonString.match(/"title"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1];
      const contentMatch = jsonString.match(/"content"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1];
      const summaryMatch = jsonString.match(/"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1];
      
      if (titleMatch && contentMatch) {
        // Unescape the extracted values
        const unescapeJson = (str: string) => {
          return str
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '/');
        };
        
        return {
          success: true,
          title: unescapeJson(titleMatch),
          content: unescapeJson(contentMatch),
          summary: summaryMatch ? unescapeJson(summaryMatch) : '',
        };
      }
      
      throw new Error('Could not extract required fields from JSON');
    } catch (secondError) {
      // Third attempt: request AI to fix the response
      console.error('JSON parsing failed:', {
        original: jsonMatch[0].substring(0, 500),
        firstError: firstError instanceof Error ? firstError.message : firstError,
        secondError: secondError instanceof Error ? secondError.message : secondError,
      });
      
      return {
        success: false,
        error: `Failed to parse AI response: ${secondError instanceof Error ? secondError.message : 'Unknown error'}`,
      };
    }
  }
}

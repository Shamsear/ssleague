/**
 * Bilingual News Prompts with Dynamic Tone Support
 * Generates prompts for both English and Malayalam
 */

import { NewsGenerationInput, NewsLanguage, REPORTERS } from './types';
import { determineTone, getTonePersonality, getToneInstructions } from './determine-tone';

/**
 * Generate prompt for any event type in specified language
 */
export function generatePrompt(input: NewsGenerationInput, language: NewsLanguage): string {
  const tone = determineTone(input);
  const reporter = REPORTERS[language];
  const reporterName = language === 'en' ? reporter.name_en : reporter.name_ml;
  const personality = getTonePersonality(tone, language);
  const toneInstructions = getToneInstructions(tone, language);
  
  const basePrompt = language === 'en' 
    ? generateEnglishPrompt(input, reporterName, personality, toneInstructions)
    : generateMalayalamPrompt(input, reporterName, personality, toneInstructions);
  
  return basePrompt;
}

/**
 * Generate English prompt
 */
function generateEnglishPrompt(
  input: NewsGenerationInput,
  reporterName: string,
  personality: string,
  toneInstructions: string
): string {
  const { event_type, season_name, metadata, context } = input;
  
  const baseInstructions = `You are ${reporterName}, a professional sports journalist for SS Premier Super League.
Your personality: ${personality}

Write a sports news article about the following event.

${toneInstructions}

Tournament: SS Premier Super League (eFootball/PES Esports Competition)
Season: ${season_name || 'Current Season'}
`;

  const eventContext = getEventContext(event_type, metadata, context, 'en');
  
  const formatInstructions = `
Requirements:
- Write in third-person as a journalist reporting news
- Headlines should be under 80 characters
- Keep content 2-3 paragraphs, ~150-200 words
- Include a short summary (1 sentence, under 100 characters)
- Use proper journalistic style

IMPORTANT - Make each article UNIQUE:
- Vary your writing style and sentence structure
- Use different opening hooks (questions, quotes, stats, dramatic statements)
- Add variety: use metaphors, analogies, or comparisons
- Include specific details and context when available
- Avoid repetitive phrases like "has officially" or "it's official"
- Change up transitions between paragraphs
- Make headlines creative and attention-grabbing
- Add personality - don't sound like a robot

Format your response as JSON:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}`;

  return baseInstructions + eventContext + formatInstructions;
}

/**
 * Generate Malayalam prompt
 */
function generateMalayalamPrompt(
  input: NewsGenerationInput,
  reporterName: string,
  personality: string,
  toneInstructions: string
): string {
  const { event_type, season_name, metadata, context } = input;
  
  const baseInstructions = `നിങ്ങൾ ${reporterName}, SS Premier Super League-ന്റെ കായിക റിപ്പോർട്ടറാണ്.
നിങ്ങളുടെ സ്വഭാവം: ${personality}

ഇനിപ്പറയുന്ന സംഭവത്തെക്കുറിച്ച് ഒരു കായിക വാർത്ത എഴുതുക.

${toneInstructions}

ടൂർണമെന്റ്: SS Premier Super League (eFootball/PES ഇ-സ്പോർട്സ് മത്സരം)
സീസൺ: ${season_name || 'നിലവിലെ സീസൺ'}
`;

  const eventContext = getEventContext(event_type, metadata, context, 'ml');
  
  const formatInstructions = `
ആവശ്യകതകൾ:
- മൂന്നാം വ്യക്തിയിൽ ഒരു പത്രപ്രവർത്തകനായി എഴുതുക
- തലക്കെട്ടുകൾ 80 അക്ഷരങ്ങൾക്കുള്ളിൽ ആയിരിക്കണം
- ഉള്ളടക്കം 2-3 ഖണ്ഡികകൾ, ~150-200 വാക്കുകൾ
- ഒരു ചെറിയ സംഗ്രഹം ഉൾപ്പെടുത്തുക (1 വാക്യം, 100 അക്ഷരങ്ങൾക്ക് കീഴിൽ)
- ശരിയായ പത്രപ്രവർത്തന ശൈലി ഉപയോഗിക്കുക
- ശുദ്ധമായ മലയാളം ഉപയോഗിക്കുക (ഇംഗ്ലീഷ് പരിഭാഷയല്ല)

പ്രധാനം - ഓരോ ലേഖനവും അദ്വിതീയമാക്കുക:
- എഴുത്ത് ശൈലിയും വാക്യഘടനയും വ്യത്യസ്തമാക്കുക
- വ്യത്യസ്ത തുടക്കങ്ങൾ ഉപയോഗിക്കുക (ചോദ്യങ്ങൾ, ഉദ്ധരണികൾ, സ്ഥിതിവിവരക്കണക്കുകൾ, നാടകീയ പ്രസ്താവനകൾ)
- വൈവിധ്യം ചേർക്കുക: രൂപകങ്ങൾ, സാമ്യങ്ങൾ, താരതമ്യങ്ങൾ ഉപയോഗിക്കുക
- വിശദാംശങ്ങളും സന്ദർഭവും ഉൾപ്പെടുത്തുക
- ആവർത്തിച്ചുള്ള വാക്യങ്ങൾ ഒഴിവാക്കുക
- ഖണ്ഡികകൾക്കിടയിൽ വ്യത്യസ്ത പരിവർത്തനങ്ങൾ ഉപയോഗിക്കുക
- തലക്കെട്ടുകൾ സൃഷ്ടിപരവും ശ്രദ്ധേയവുമാക്കുക
- വ്യക്തിത്വം ചേർക്കുക - റോബോട്ട് പോലെ തോന്നരുത്

JSON ഫോർമാറ്റിൽ പ്രതികരണം നൽകുക:
{
  "title": "...",
  "content": "...",
  "summary": "..."
}`;

  return baseInstructions + eventContext + formatInstructions;
}

/**
 * Get event-specific context for prompts
 */
function getEventContext(
  event_type: string,
  metadata: any,
  context: string | undefined,
  language: NewsLanguage
): string {
  // This function returns event-specific details in the appropriate language
  
  if (language === 'en') {
    return getEnglishEventContext(event_type, metadata, context);
  } else {
    return getMalayalamEventContext(event_type, metadata, context);
  }
}

/**
 * English event context
 */
function getEnglishEventContext(event_type: string, metadata: any, context?: string): string {
  switch (event_type) {
    case 'match_result':
      return `
Event: Match Result
- Home Team: ${metadata.home_team}
- Away Team: ${metadata.away_team}
- Score: ${metadata.home_score} - ${metadata.away_score}
- Winner: ${metadata.winner || 'Draw'}
${metadata.goal_diff ? `- Goal Difference: ${metadata.goal_diff}` : ''}
${context ? `\nAdditional Info:\n${context}` : ''}

Report this match result. Describe the game, key moments, and what it means for both teams.`;

    case 'player_milestone':
      return `
Event: Registration Milestone
- Milestone: ${metadata.milestone_number || metadata.player_count} players registered!
${context ? `\n${context}` : ''}

Report this registration milestone achievement. Emphasize growing tournament popularity.`;

    case 'team_roster_complete':
      return `
Event: Team Roster Finalized
- Team: ${metadata.team_name}
- Squad Size: ${metadata.player_count} players (minimum ${metadata.min_players || 5} required)
- Total Spent: $${metadata.total_spent}
- Remaining Budget: $${metadata.remaining_budget}
${context ? `\nRoster Details:\n${context}` : ''}

Report that ${metadata.team_name} has finalized their squad with ${metadata.player_count} players. Note that teams complete their roster when they reach the minimum required players (typically 5-7 depending on tournament format). Analyze their signings and prospects for the season.`;

    case 'hat_trick':
      return `
Event: Hat-Trick Performance
- Player: ${metadata.player_name}
- Team: ${metadata.team_name}
- Goals Scored: ${metadata.goals || '3+'}
- Match: ${metadata.home_team} vs ${metadata.away_team}

Celebrate this incredible hat-trick performance!`;

    case 'thrashing':
      return `
Event: Dominant Victory / Thrashing
- Winner: ${metadata.winner}
- Loser: ${metadata.loser}
- Score: ${metadata.score}
- Goal Difference: ${metadata.goal_diff}

Report this one-sided match. Be critical of the losing team's performance.`;

    case 'comeback_victory':
      return `
Event: Comeback Victory
- Winner: ${metadata.winner}
- Halftime Score: ${metadata.halftime_score}
- Final Score: ${metadata.final_score}

Report this dramatic comeback. Build the narrative of how they turned it around.`;

    case 'auction_completed':
      return `
Event: Auction Completed
- Total Spent: $${metadata.total_spent}
- Players Auctioned: ${metadata.player_count}
${context ? `\n${context}` : ''}

Report the auction completion. Highlight top signings and spending patterns.`;

    case 'tiebreaker_battle':
      return `
Event: Tiebreaker Round Drama
- Player: ${metadata.player_name}
- Teams Bidding: ${metadata.team_count}
- Winning Team: ${metadata.winning_team}
- Winning Bid: $${metadata.winning_bid}

Report this intense tiebreaker round competition. Multiple teams fought for this player!`;

    case 'golden_boot_winner':
      return `
Event: Golden Boot Winner Announced
- Winner: ${metadata.player_name}
- Goals Scored: ${metadata.goals}
- Team: ${metadata.team_name}

Celebrate the golden boot winner! Recap their goal-scoring journey this season.`;

    case 'season_winner':
      return `
Event: Season Champions Crowned
- Champions: ${metadata.winner || metadata.team_name}
- Runners Up: ${metadata.runner_up}
${context ? `\n${context}` : ''}

Report the season championship victory. Celebrate the winners, acknowledge runners-up.`;

    case 'poll_results':
      return `
Event: Poll Results Announced
- Poll Type: ${metadata.result_type}
- Question: ${metadata.poll_question_en}
- Winner: ${metadata.winner_text_en}
- Winning Percentage: ${metadata.winner_percentage}%
- Total Votes: ${metadata.total_votes}
${metadata.top_results ? `\nTop 3 Results:\n${metadata.top_results.map((r: any, i: number) => `${i + 1}. ${r.text_en} - ${r.votes} votes (${r.percentage}%)`).join('\n')}` : ''}

Report these poll results. Announce the winner, show vote percentages, discuss fan engagement.`;

    default:
      return `
Event Type: ${event_type}
${context ? `Context:\n${context}` : ''}
${JSON.stringify(metadata, null, 2)}

Report this event with appropriate tone and style.`;
  }
}

/**
 * Malayalam event context
 */
function getMalayalamEventContext(event_type: string, metadata: any, context?: string): string {
  switch (event_type) {
    case 'match_result':
      return `
സംഭവം: മത്സര ഫലം
- ഹോം ടീം: ${metadata.home_team}
- എവേ ടീം: ${metadata.away_team}
- സ്കോർ: ${metadata.home_score} - ${metadata.away_score}
- ജേതാവ്: ${metadata.winner || 'സമനില'}
${metadata.goal_diff ? `- ഗോൾ വ്യത്യാസം: ${metadata.goal_diff}` : ''}
${context ? `\nഅധിക വിവരങ്ങൾ:\n${context}` : ''}

ഈ മത്സര ഫലം റിപ്പോർട്ട് ചെയ്യുക. കളി, പ്രധാന നിമിഷങ്ങൾ, രണ്ട് ടീമുകൾക്കും ഇതിന്റെ അർത്ഥമെന്താണ് എന്ന് വിവരിക്കുക.`;

    case 'player_milestone':
      return `
സംഭവം: രജിസ്ട്രേഷൻ നാഴികക്കല്ല്
- നാഴികക്കല്ല്: ${metadata.milestone_number || metadata.player_count} കളിക്കാർ രജിസ്റ്റർ ചെയ്തു!
${context ? `\n${context}` : ''}

ഈ രജിസ്ട്രേഷൻ നാഴികക്കല്ല് നേട്ടം റിപ്പോർട്ട് ചെയ്യുക. വർദ്ധിച്ചുവരുന്ന ടൂർണമെന്റ് ജനപ്രീതി ഊന്നിപ്പറയുക.`;

    case 'team_roster_complete':
      return `
സംഭവം: ടീം സ്ക്വാഡ് അന്തിമമാക്കി
- ടീം: ${metadata.team_name}
- സ്ക്വാഡ് വലുപ്പം: ${metadata.player_count} കളിക്കാർ (കുറഞ്ഞത് ${metadata.min_players || 5} ആവശ്യമാണ്)
- മൊത്തം ചെലവ്: $${metadata.total_spent}
- ശേഷിക്കുന്ന ബഡ്ജറ്റ്: $${metadata.remaining_budget}
${context ? `\nപട്ടിക വിശദാംശങ്ങൾ:\n${context}` : ''}

${metadata.team_name} ${metadata.player_count} കളിക്കാരുമായി അവരുടെ സ്ക്വാഡ് അന്തിമമാക്കിയെന്ന് റിപ്പോർട്ട് ചെയ്യുക. ടീമുകൾ കുറഞ്ഞത് ആവശ്യമായ കളിക്കാരെ (ടൂർണമെന്റ് ഫോർമാറ്റ് അനുസരിച്ച് സാധാരണയായി 5-7) എത്തുമ്പോൾ അവരുടെ റോസ്റ്റർ പൂർത്തിയാക്കുന്നുവെന്ന് ശ്രദ്ധിക്കുക. അവരുടെ ഒപ്പിടലുകളും സീസണിലേക്കുള്ള സാധ്യതകളും വിശകലനം ചെയ്യുക.`;

    case 'hat_trick':
      return `
സംഭവം: ഹാട്രിക്ക് പ്രകടനം
- കളിക്കാരൻ: ${metadata.player_name}
- ടീം: ${metadata.team_name}
- ഗോളുകൾ: ${metadata.goals || '3+'}
- മത്സരം: ${metadata.home_team} vs ${metadata.away_team}

ഈ അവിശ്വസനീയമായ ഹാട്രിക്ക് പ്രകടനം ആഘോഷിക്കുക!`;

    case 'thrashing':
      return `
സംഭവം: കനത്ത തോൽവി / തകർത്തടിക്കൽ
- ജേതാവ്: ${metadata.winner}
- തോറ്റവർ: ${metadata.loser}
- സ്കോർ: ${metadata.score}
- ഗോൾ വ്യത്യാസം: ${metadata.goal_diff}

ഈ ഏകപക്ഷീയമായ മത്സരം റിപ്പോർട്ട് ചെയ്യുക. തോൽക്കുന്ന ടീമിന്റെ പ്രകടനത്തെ വിമർശിക്കുക.`;

    case 'comeback_victory':
      return `
സംഭവം: തിരിച്ചുവരവ് വിജയം
- ജേതാവ്: ${metadata.winner}
- പകുതി സമയ സ്കോർ: ${metadata.halftime_score}
- അവസാന സ്കോർ: ${metadata.final_score}

ഈ നാടകീയമായ തിരിച്ചുവരവ് റിപ്പോർട്ട് ചെയ്യുക. അവർ എങ്ങനെ മറിച്ചടിച്ചു എന്ന കഥ നിർമ്മിക്കുക.`;

    case 'auction_completed':
      return `
സംഭവം: ലേലം പൂർത്തിയായി
- മൊത്തം ചെലവ്: $${metadata.total_spent}
- ലേലം ചെയ്ത കളിക്കാർ: ${metadata.player_count}
${context ? `\n${context}` : ''}

ലേലം പൂർത്തീകരണം റിപ്പോർട്ട് ചെയ്യുക. മികച്ച ഒപ്പിടലുകളും ചെലവ് രീതികളും ഹൈലൈറ്റ് ചെയ്യുക.`;

    case 'tiebreaker_battle':
      return `
സംഭവം: ടൈബ്രേക്കർ റൗണ്ട് ഡ്രാമ
- കളിക്കാരൻ: ${metadata.player_name}
- ബിഡ് ചെയ്ത ടീമുകൾ: ${metadata.team_count}
- വിജയിച്ച ടീം: ${metadata.winning_team}
- വിജയിച്ച ബിഡ്: $${metadata.winning_bid}

ഈ തീവ്രമായ ടൈബ്രേക്കർ റൗണ്ട് മത്സരം റിപ്പോർട്ട് ചെയ്യുക. ഒന്നിലധികം ടീമുകൾ ഈ കളിക്കാരനായി പോരാടി!`;

    case 'golden_boot_winner':
      return `
സംഭവം: ഗോൾഡൻ ബൂട്ട് വിജയി പ്രഖ്യാപിച്ചു
- വിജയി: ${metadata.player_name}
- ഗോളുകൾ: ${metadata.goals}
- ടീം: ${metadata.team_name}

ഗോൾഡൻ ബൂട്ട് വിജയിയെ ആഘോഷിക്കുക! ഈ സീസണിലെ അവരുടെ ഗോൾ യാത്ര ആവർത്തിക്കുക.`;

    case 'season_winner':
      return `
സംഭവം: സീസൺ ചാമ്പ്യൻമാരെ പ്രഖ്യാപിച്ചു
- ചാമ്പ്യൻമാർ: ${metadata.winner || metadata.team_name}
- റണ്ണേഴ്സ് അപ്പ്: ${metadata.runner_up}
${context ? `\n${context}` : ''}

സീസൺ ചാമ്പ്യൻഷിപ്പ് വിജയം റിപ്പോർട്ട് ചെയ്യുക. വിജയികളെ ആഘോഷിക്കുക, റണ്ണേഴ്സ് അപ്പിനെ അംഗീകരിക്കുക.`;

    case 'poll_results':
      return `
സംഭവം: പോൾ ഫലങ്ങൾ പ്രഖ്യാപിച്ചു
- പോൾ തരം: ${metadata.result_type}
- ചോദ്യം: ${metadata.poll_question_ml}
- വിജയി: ${metadata.winner_text_ml}
- വിജയ ശതമാനം: ${metadata.winner_percentage}%
- മൊത്തം വോട്ടുകൾ: ${metadata.total_votes}
${metadata.top_results ? `\nമികച്ച 3 ഫലങ്ങൾ:\n${metadata.top_results.map((r: any, i: number) => `${i + 1}. ${r.text_ml} - ${r.votes} വോട്ടുകൾ (${r.percentage}%)`).join('\n')}` : ''}

ഈ പോൾ ഫലങ്ങൾ റിപ്പോർട്ട് ചെയ്യുക. വിജയിയെ പ്രഖ്യാപിക്കുക, വോട്ട് ശതമാനം കാണിക്കുക, ആരാധകരുടെ ഇടപെടൽ ചർച്ച ചെയ്യുക.`;

    default:
      return `
സംഭവ തരം: ${event_type}
${context ? `സന്ദർഭം:\n${context}` : ''}
${JSON.stringify(metadata, null, 2)}

ഉചിതമായ സ്വരവും ശൈലിയും ഉപയോഗിച്ച് ഈ സംഭവം റിപ്പോർട്ട് ചെയ്യുക.`;
  }
}

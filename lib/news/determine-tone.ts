/**
 * Tone Determination System
 * Automatically determines appropriate tone based on event type and context
 */

import { NewsEventType, NewsTone, NewsGenerationInput } from './types';

/**
 * Determine appropriate tone for a news event
 */
export function determineTone(input: NewsGenerationInput): NewsTone {
  const { event_type, metadata } = input;
  
  // If tone is explicitly provided, use it
  if (input.tone) {
    return input.tone;
  }
  
  // Match Events - Based on score/outcome
  if (event_type === 'match_result') {
    const goalDiff = Math.abs((metadata.home_score || 0) - (metadata.away_score || 0));
    if (goalDiff >= 5) return 'harsh'; // Thrashing - roast the loser
    if (goalDiff === 0) return 'funny'; // Draw - make it entertaining
    return 'dramatic'; // Normal result
  }
  
  if (event_type === 'comeback_victory') return 'dramatic';
  if (event_type === 'thrashing') return 'harsh';
  if (event_type === 'last_gasp_winner') return 'dramatic';
  if (event_type === 'upset_shock') return 'dramatic';
  if (event_type === 'penalty_drama') return 'dramatic';
  if (event_type === 'draw_bore') return 'harsh'; // Boring 0-0
  if (event_type === 'hat_trick') return 'dramatic';
  if (event_type === 'clean_sheet_masterclass') return 'dramatic';
  if (event_type === 'goalkeeper_howler') return 'harsh'; // Roast the GK
  if (event_type === 'red_card_controversy') return 'dramatic';
  if (event_type === 'tactical_masterclass') return 'dramatic';
  if (event_type === 'tactical_disaster') return 'harsh';
  
  // Streaks
  if (event_type === 'unbeaten_run') return 'dramatic';
  if (event_type === 'losing_streak') return 'harsh';
  
  // Player Performance
  if (event_type === 'player_form_explosion') return 'dramatic';
  if (event_type === 'player_form_crisis') return 'harsh';
  if (event_type === 'star_rating_upgrade') return 'dramatic';
  if (event_type === 'star_rating_downgrade') return 'harsh';
  if (event_type === 'category_promotion') return 'dramatic';
  if (event_type === 'category_demotion') return 'harsh';
  if (event_type === 'player_injury') return 'neutral'; // Serious, not funny
  
  // Team Events
  if (event_type === 'team_budget_crisis') return 'harsh'; // Funny roast
  if (event_type === 'team_budget_surplus') return 'harsh'; // Roast for not spending
  if (event_type === 'star_signing') return 'dramatic';
  if (event_type === 'surprise_signing') return 'funny';
  if (event_type === 'player_released') return 'harsh';
  
  // Auction Events
  if (event_type === 'tiebreaker_battle') return 'dramatic';
  if (event_type === 'record_breaking_bid') return 'dramatic';
  if (event_type === 'bargain_steal') return 'funny';
  if (event_type === 'player_unsold') return 'harsh'; // Sad for player
  if (event_type === 'last_second_snipe') return 'dramatic';
  if (event_type === 'overpay_disaster') return 'harsh'; // Roast overpaying
  if (event_type === 'budget_depletion') return 'harsh';
  
  // Fantasy Events
  if (event_type === 'fantasy_captain_fail') return 'harsh'; // Funny roast
  if (event_type === 'fantasy_hero') return 'dramatic';
  if (event_type === 'fantasy_bust') return 'harsh';
  if (event_type === 'fantasy_perfect_week') return 'dramatic';
  if (event_type === 'fantasy_disaster_week') return 'harsh';
  
  // Lineup Events
  if (event_type === 'lineup_not_submitted') return 'harsh'; // Shame them
  if (event_type === 'category_violation') return 'harsh';
  if (event_type === 'lineup_locked') return 'neutral';
  
  // Registration Events
  if (event_type === 'player_milestone') return 'dramatic';
  if (event_type === 'registration_opening') return 'dramatic';
  if (event_type === 'early_bird_surge') return 'funny';
  
  // Season Events
  if (event_type === 'season_launched') return 'dramatic';
  if (event_type === 'season_winner') return 'dramatic';
  if (event_type === 'finals_result') return 'dramatic';
  if (event_type === 'semifinals_result') return 'dramatic';
  
  // Awards
  if (event_type === 'golden_boot_winner') return 'dramatic';
  if (event_type === 'golden_glove_winner') return 'dramatic';
  
  // Standings
  if (event_type === 'league_leaders_change') return 'dramatic';
  if (event_type === 'relegation_battle') return 'dramatic';
  if (event_type === 'top_4_race') return 'dramatic';
  
  // Default to neutral for everything else
  return 'neutral';
}

/**
 * Get tone personality description for prompts
 */
export function getTonePersonality(tone: NewsTone, language: 'en' | 'ml'): string {
  if (language === 'en') {
    switch (tone) {
      case 'funny':
        return 'witty, entertaining, use humor and sarcasm appropriately';
      case 'harsh':
        return 'critical, sarcastic, roasting underperformers, brutally honest';
      case 'dramatic':
        return 'intense, storytelling, building excitement and tension';
      case 'neutral':
      default:
        return 'professional, balanced, informative';
    }
  } else {
    switch (tone) {
      case 'funny':
        return 'രസകരവും വിനോദപ്രദവുമായ, ഹാസ്യവും വിദ്രൂപവും ഉപയോഗിക്കുക';
      case 'harsh':
        return 'വിമർശനാത്മകവും കടുപ്പമുള്ളതും, മോശം പ്രകടനക്കാരെ വിമർശിക്കുക';
      case 'dramatic':
        return 'ആവേശകരവും കഥപറച്ചിലുള്ളതും, ട്രില്ലും ആവേശവും സൃഷ്ടിക്കുക';
      case 'neutral':
      default:
        return 'പ്രൊഫഷണലും സമതുലിതവുമായ, വിവരദായകം';
    }
  }
}

/**
 * Get tone-specific instructions for content
 */
export function getToneInstructions(tone: NewsTone, language: 'en' | 'ml', context?: any): string {
  if (language === 'en') {
    switch (tone) {
      case 'funny':
        return '- Add witty commentary and jokes\n- Use clever wordplay\n- Keep it light and entertaining\n- Make readers smile';
      case 'harsh':
        return '- Be brutally honest and critical\n- Roast poor performances\n- Use sarcasm effectively\n- Don\'t hold back on criticism';
      case 'dramatic':
        return '- Build narrative tension\n- Use vivid descriptions\n- Create excitement and anticipation\n- Tell it like an epic story';
      case 'neutral':
      default:
        return '- Be factual and informative\n- Maintain professional tone\n- Provide balanced analysis';
    }
  } else {
    switch (tone) {
      case 'funny':
        return '- രസകരമായ കമന്ററി ചേർക്കുക\n- വാക്കുകളുടെ കളി ഉപയോഗിക്കുക\n- ലഘുവും വിനോദപ്രദവുമാക്കുക\n- വായനക്കാരെ ചിരിപ്പിക്കുക';
      case 'harsh':
        return '- നിശിതമായി വിമർശിക്കുക\n- മോശം പ്രകടനങ്ങളെ കുറ്റപ്പെടുത്തുക\n- വിദ്രൂപം ഫലപ്രദമായി ഉപയോഗിക്കുക\n- വിമർശനത്തിൽ പിന്നോട്ട് പോകരുത്';
      case 'dramatic':
        return '- കഥാപാത്രത്തിന്റെ പിരിമുറുക്കം സൃഷ്ടിക്കുക\n- വ്യക്തമായ വിവരണങ്ങൾ ഉപയോഗിക്കുക\n- ആവേശവും പ്രതീക്ഷയും സൃഷ്ടിക്കുക\n- ഒരു മഹാകാവ്യം പോലെ പറയുക';
      case 'neutral':
      default:
        return '- വസ്തുതാപരവും വിവരദായകവുമായിരിക്കുക\n- പ്രൊഫഷണൽ ടോൺ നിലനിർത്തുക\n- സമതുലിതമായ വിശകലനം നൽകുക';
    }
  }
}

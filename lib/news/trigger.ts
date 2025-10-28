import { NewsGenerationInput, NewsEventType, NewsCategory, NewsMetadata } from './types';

/**
 * Trigger AI news generation for an event
 * This function can be called from any API route
 * It makes a request to the news API to generate and save news
 */
export async function triggerNewsGeneration(input: NewsGenerationInput): Promise<void> {
  try {
    // Make internal API call to generate news
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        generate_with_ai: true,
        generation_input: input,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to generate news:', error);
    } else {
      const result = await response.json();
      console.log('News generated successfully:', result.news_id);
    }
  } catch (error) {
    // Silently fail - don't break the main operation
    console.error('Error triggering news generation:', error);
  }
}

/**
 * Check if a milestone has been reached for news generation
 * Returns true if this count is a milestone worth announcing
 */
export function isPlayerMilestone(count: number): boolean {
  const milestones = [10, 25, 50, 75, 100, 150, 200, 250, 300];
  return milestones.includes(count);
}

/**
 * Get milestone number from player count
 */
export function getMilestoneNumber(count: number): number | null {
  if (isPlayerMilestone(count)) {
    return count;
  }
  return null;
}

/**
 * Map event type to category
 */
function getEventCategory(eventType: NewsEventType): NewsCategory {
  if (eventType.includes('player_milestone') || eventType.includes('registration')) return 'registration';
  if (eventType.includes('team')) return 'team';
  if (eventType.includes('auction')) return 'auction';
  if (eventType.includes('fantasy')) return 'fantasy';
  if (eventType.includes('match') || eventType.includes('result') || eventType.includes('tournament') || eventType.includes('finals') || eventType.includes('semifinals')) return 'match';
  if (eventType.includes('season')) return 'announcement';
  return 'announcement';
}

/**
 * Simplified trigger function - automatically determines category
 * @param eventType - Type of news event
 * @param metadata - Event-specific data
 */
export async function triggerNews(
  eventType: NewsEventType,
  metadata: NewsMetadata & { season_id?: string; season_name?: string; context?: string }
): Promise<void> {
  const category = getEventCategory(eventType);
  
  console.log('📢 Triggering news:', {
    eventType,
    category,
    season_id: metadata.season_id,
    team_name: metadata.team_name,
    player_count: metadata.player_count,
  });
  
  await triggerNewsGeneration({
    event_type: eventType,
    category,
    season_id: metadata.season_id,
    season_name: metadata.season_name,
    metadata,
    context: metadata.context,
  });
  
  console.log('✅ News trigger completed for:', eventType);
}

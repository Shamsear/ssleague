import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGING_FACE_TOKEN);

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  model?: string;
}

/**
 * Generate an image using Hugging Face FLUX.1-schnell
 * @param prompt - The image description
 * @param options - Image generation options
 * @returns Promise<Blob> - The generated image as a Blob
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<Blob> {
  const {
    width = 1200,
    height = 630,
    model = 'black-forest-labs/FLUX.1-schnell',
  } = options;

  try {
    console.log(`🎨 Generating image with FLUX.1: "${prompt}"`);
    
    const blob = await hf.textToImage({
      model,
      inputs: prompt,
      parameters: {
        width,
        height,
      },
    });

    console.log(`✅ Image generated successfully (${blob.size} bytes)`);
    return blob;
  } catch (error) {
    console.error('Failed to generate image:', error);
    throw error;
  }
}

/**
 * Generate a prompt optimized for news images based on event type
 */
export function generateNewsImagePrompt(
  eventType: string,
  metadata: Record<string, any>
): string {
  const style = 'eFootball PES style, soccer esports tournament, dynamic football gaming graphics, modern design, vibrant stadium colors, high quality digital art';

  switch (eventType) {
    case 'player_milestone':
      return `eFootball esports tournament registration milestone, ${metadata.milestone_number} competitive players joined, gaming controllers and soccer ball, pro evolution soccer theme, ${style}`;

    case 'team_registered':
      const teamStatus = metadata.is_returning ? 'returning champions' : 'new challengers';
      return `eFootball team ${metadata.team_name} ${teamStatus} banner, esports soccer team announcement, competitive gaming atmosphere, ${style}`;

    case 'auction_start':
      return `eFootball player auction live, ${metadata.position} position bidding war, virtual transfer market, gaming auction excitement, ${style}`;

    case 'auction_results':
      return `eFootball auction complete, ${metadata.total_players} pro players signed, esports transfer window closed, virtual squad building, ${style}`;

    case 'match_result':
      return `eFootball match result screen: ${metadata.home_team_name} ${metadata.home_score}-${metadata.away_score} ${metadata.away_team_name}, victory celebration, esports soccer competition, gaming tournament atmosphere, ${style}`;

    case 'fantasy_draft':
      return `eFootball fantasy draft, ${metadata.total_drafted} virtual players picked, esports fantasy league excitement, competitive gaming, ${style}`;

    case 'registration_phase_change':
      return `eFootball tournament ${metadata.new_phase} registration open, competitive soccer gaming, join now esports call to action, ${style}`;

    case 'confirmed_slots_filled':
      return `eFootball tournament slots filled, ${metadata.confirmed_count} esports competitors confirmed, registration milestone reached, ${style}`;

    case 'season_launched':
      return `New eFootball season launch, SS Premier Super League esports tournament begins, competitive soccer gaming, grand season opening, ${style}`;

    case 'finals_result':
      return `eFootball championship trophy celebration, esports tournament finals winner crowned, competitive soccer gaming victory, ${style}`;

    default:
      return `eFootball esports tournament news graphic, competitive soccer gaming announcement, ${style}`;
  }
}

/**
 * Upload image blob to Firebase Storage and return public URL
 */
export async function uploadImageToStorage(
  blob: Blob,
  newsId: string
): Promise<string> {
  // Convert blob to base64 for Firebase Storage upload
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');

  // For now, we'll save locally or use a service
  // You can integrate Firebase Storage here if needed
  
  // Temporary: Return a data URL (for development)
  const dataUrl = `data:image/png;base64,${base64}`;
  
  console.log(`📦 Image data URL created (${dataUrl.length} chars)`);
  return dataUrl;
}

/**
 * Fetch real player/team data for image context
 */
export async function fetchRealImageContext(
  eventType: string,
  metadata: Record<string, any>
): Promise<{ hasRealData: boolean; context: string }> {
  try {
    let context = '';
    let hasRealData = false;

    switch (eventType) {
      case 'team_registered':
        if (metadata.team_logo) {
          context = `featuring ${metadata.team_name} team logo and colors`;
          hasRealData = true;
        }
        if (metadata.team_colors) {
          context += `, team colors: ${metadata.team_colors}`;
        }
        break;

      case 'match_result':
        if (metadata.home_team_logo || metadata.away_team_logo) {
          context = `featuring team logos: ${metadata.home_team_name} vs ${metadata.away_team_name}`;
          hasRealData = true;
        }
        if (metadata.player_of_match_photo) {
          context += `, spotlight on player ${metadata.player_of_match}`;
        }
        break;

      case 'auction_results':
        if (metadata.top_player_photo) {
          context = `featuring highest bid player photo`;
          hasRealData = true;
        }
        break;

      case 'player_milestone':
        // Generic tournament branding
        context = 'SS Premier Super League branding and eFootball theme';
        break;
    }

    return { hasRealData, context };
  } catch (error) {
    console.error('Failed to fetch real image context:', error);
    return { hasRealData: false, context: '' };
  }
}

/**
 * Generate and upload news image in one go
 */
export async function generateNewsImage(
  eventType: string,
  metadata: Record<string, any>,
  newsId: string
): Promise<string | null> {
  try {
    // Check if AI generation is configured
    if (!process.env.HUGGING_FACE_TOKEN) {
      console.warn('⚠️ HUGGING_FACE_TOKEN not configured, skipping image generation');
      return null;
    }

    // Fetch real data context (player photos, team logos, etc.)
    const { hasRealData, context } = await fetchRealImageContext(eventType, metadata);
    
    if (hasRealData) {
      console.log(`🎨 Generating image WITH real data: ${context}`);
    } else {
      console.log('🎨 Generating generic tournament image');
    }

    // Generate optimized prompt (includes real data context)
    const basePrompt = generateNewsImagePrompt(eventType, metadata);
    const enhancedPrompt = hasRealData 
      ? `${basePrompt}, ${context}` 
      : basePrompt;

    // Generate image using real data context
    const imageBlob = await generateImage(enhancedPrompt);

    // Upload to storage (returns data URL for now)
    const imageUrl = await uploadImageToStorage(imageBlob, newsId);

    return imageUrl;
  } catch (error) {
    console.error('Failed to generate news image:', error);
    return null; // Return null instead of failing the whole operation
  }
}

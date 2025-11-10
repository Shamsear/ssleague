import { HfInference } from '@huggingface/inference';
import sharp from 'sharp';

const hf = new HfInference(process.env.HUGGING_FACE_TOKEN);

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  model?: string;
}

/**
 * Generate an image using Stable Diffusion XL (better text than FLUX)
 * @param prompt - The image description with text
 * @returns Promise<Blob> - The generated image as a Blob
 */
export async function generateImageWithSDXL(
  prompt: string
): Promise<Blob> {
  try {
    console.log(`🎨 Generating image with SDXL: "${prompt}"`);
    
    const blob = await hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      inputs: prompt,
      parameters: {
        width: 1200,
        height: 630,
      },
    });

    console.log(`✅ Image generated successfully with SDXL (${blob.size} bytes)`);
    return blob;
  } catch (error) {
    console.error('Failed to generate image with SDXL:', error);
    throw error;
  }
}

/**
 * Generate an image using Hugging Face FLUX.1-schnell (fallback)
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
 * Add text overlay to an image
 */
export async function addTextOverlay(
  imageBuffer: Buffer,
  eventType: string,
  metadata: Record<string, any>
): Promise<Buffer> {
  try {
    const width = 1200;
    const height = 630;

    // Create SVG text overlay based on event type
    let svgOverlay = '';

    switch (eventType) {
      case 'match_result':
        svgOverlay = `
          <svg width="${width}" height="${height}">
            <!-- Dark gradient background -->
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:rgba(0,0,0,0.3);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(0,0,0,0.95);stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect x="0" y="400" width="${width}" height="230" fill="url(#grad1)" />
            
            <!-- Top accent line -->
            <rect x="0" y="400" width="${width}" height="4" fill="#0066FF" />
            
            <!-- Title with glow -->
            <text x="${width / 2}" y="450" font-family="Arial Black, sans-serif" font-size="28" font-weight="900" fill="#0066FF" text-anchor="middle" letter-spacing="2">
              MATCH RESULT
            </text>
            
            <!-- Score display -->
            <text x="${width / 2}" y="530" font-family="Impact, sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle" stroke="#0066FF" stroke-width="3">
              ${metadata.home_score} - ${metadata.away_score}
            </text>
            
            <!-- Team names -->
            <text x="250" y="600" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">
              ${metadata.home_team_name}
            </text>
            <text x="${width - 250}" y="600" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">
              ${metadata.away_team_name}
            </text>
          </svg>
        `;
        break;

      case 'team_registered':
        svgOverlay = `
          <svg width="${width}" height="${height}">
            <defs>
              <linearGradient id="gradTeam" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:rgba(0,102,255,0.9);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(0,0,139,0.95);stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect x="0" y="430" width="${width}" height="200" fill="url(#gradTeam)" />
            <rect x="0" y="430" width="${width}" height="5" fill="#FFD700" />
            
            <text x="${width / 2}" y="490" font-family="Arial Black, sans-serif" font-size="32" font-weight="900" fill="white" text-anchor="middle" letter-spacing="3">
              TEAM REGISTERED
            </text>
            <text x="${width / 2}" y="570" font-family="Impact, sans-serif" font-size="64" font-weight="bold" fill="#FFD700" text-anchor="middle" stroke="white" stroke-width="2">
              ${metadata.team_name}
            </text>
          </svg>
        `;
        break;

      case 'player_milestone':
        svgOverlay = `
          <svg width="${width}" height="${height}">
            <defs>
              <linearGradient id="gradMilestone" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:rgba(34,139,34,0.9);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(0,100,0,0.95);stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect x="0" y="430" width="${width}" height="200" fill="url(#gradMilestone)" />
            <rect x="0" y="430" width="${width}" height="5" fill="#FFD700" />
            
            <text x="${width / 2}" y="490" font-family="Arial Black, sans-serif" font-size="30" font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">
              REGISTRATION MILESTONE
            </text>
            <text x="${width / 2}" y="580" font-family="Impact, sans-serif" font-size="72" font-weight="bold" fill="#FFD700" text-anchor="middle" stroke="white" stroke-width="3">
              ${metadata.milestone_number} PLAYERS
            </text>
          </svg>
        `;
        break;

      case 'auction_results':
        svgOverlay = `
          <svg width="${width}" height="${height}">
            <defs>
              <linearGradient id="gradAuction" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:rgba(255,69,0,0.9);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(139,0,0,0.95);stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect x="0" y="430" width="${width}" height="200" fill="url(#gradAuction)" />
            <rect x="0" y="430" width="${width}" height="5" fill="#FFD700" />
            
            <text x="${width / 2}" y="490" font-family="Arial Black, sans-serif" font-size="36" font-weight="900" fill="white" text-anchor="middle" letter-spacing="3">
              AUCTION COMPLETE
            </text>
            <text x="${width / 2}" y="570" font-family="Impact, sans-serif" font-size="64" font-weight="bold" fill="#FFD700" text-anchor="middle" stroke="white" stroke-width="2">
              ${metadata.total_players} PLAYERS SIGNED
            </text>
          </svg>
        `;
        break;

      default:
        svgOverlay = `
          <svg width="${width}" height="${height}">
            <defs>
              <linearGradient id="gradDefault" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:rgba(0,0,0,0.3);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(0,0,0,0.95);stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect x="0" y="450" width="${width}" height="180" fill="url(#gradDefault)" />
            <rect x="0" y="450" width="${width}" height="5" fill="#0066FF" />
            
            <text x="${width / 2}" y="555" font-family="Impact, sans-serif" font-size="56" font-weight="bold" fill="white" text-anchor="middle" stroke="#0066FF" stroke-width="2" letter-spacing="2">
              SS PREMIER SUPER LEAGUE
            </text>
          </svg>
        `;
    }

    // Composite the text overlay onto the image
    const outputBuffer = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      }])
      .png()
      .toBuffer();

    console.log('✅ Text overlay added successfully');
    return outputBuffer;
  } catch (error) {
    console.error('Failed to add text overlay:', error);
    throw error;
  }
}

/**
 * Generate a prompt optimized for SDXL (WITH text instructions)
 */
export function generateSDXLPrompt(
  eventType: string,
  metadata: Record<string, any>
): string {
  const baseStyle = 'professional esports gaming banner, eFootball tournament, modern sports graphic design, stadium atmosphere, vibrant colors, high quality, digital art';

  switch (eventType) {
    case 'match_result':
      return `${baseStyle}, text "MATCH RESULT" at top, large numbers "${metadata.home_score} - ${metadata.away_score}" in center, team names "${metadata.home_team_name}" and "${metadata.away_team_name}" below, blue and gold theme`;

    case 'team_registered':
      return `${baseStyle}, text "TEAM REGISTERED" at top, large text "${metadata.team_name}" in center, blue gradient background, celebration atmosphere`;

    case 'player_milestone':
      return `${baseStyle}, text "REGISTRATION MILESTONE" at top, large numbers "${metadata.milestone_number} PLAYERS" in center, green gradient, achievement celebration`;

    case 'auction_results':
      return `${baseStyle}, text "AUCTION COMPLETE" at top, text "${metadata.total_players} PLAYERS SIGNED" in center, orange and red gradient, excitement theme`;

    default:
      return `${baseStyle}, text "SS PREMIER SUPER LEAGUE" in center, tournament announcement banner`;
  }
}

/**
 * Generate a prompt optimized for FLUX (NO text, for overlay fallback)
 */
export function generateNewsImagePrompt(
  eventType: string,
  metadata: Record<string, any>
): string {
  const style = 'eFootball PES style, soccer esports tournament, dynamic football gaming graphics, modern design, vibrant stadium colors, high quality digital art, no text, clean background';

  switch (eventType) {
    case 'player_milestone':
      return `eFootball esports tournament registration celebration, gaming controllers and soccer ball, pro evolution soccer theme, ${style}`;

    case 'team_registered':
      return `eFootball team registration announcement background, esports soccer team banner, competitive gaming atmosphere, ${style}`;

    case 'auction_start':
      return `eFootball player auction background, virtual transfer market, gaming auction excitement, ${style}`;

    case 'auction_results':
      return `eFootball auction complete background, esports transfer window, virtual squad building celebration, ${style}`;

    case 'match_result':
      return `eFootball match result background, victory celebration stadium, esports soccer competition atmosphere, cheering crowd, ${style}`;

    case 'fantasy_draft':
      return `eFootball fantasy draft background, esports fantasy league excitement, competitive gaming atmosphere, ${style}`;

    case 'registration_phase_change':
      return `eFootball tournament registration background, competitive soccer gaming atmosphere, ${style}`;

    case 'confirmed_slots_filled':
      return `eFootball tournament slots filled celebration background, esports competitors atmosphere, ${style}`;

    case 'season_launched':
      return `New eFootball season launch background, grand season opening celebration, competitive soccer gaming stadium, ${style}`;

    case 'finals_result':
      return `eFootball championship trophy celebration background, esports tournament finals atmosphere, fireworks and confetti, ${style}`;

    default:
      return `eFootball esports tournament background, competitive soccer gaming atmosphere, ${style}`;
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
 * Generate image URL using Pollinations.ai (FREE, no API key needed)
 */
export function generateImageWithPollinations(
  prompt: string,
  width: number = 1200,
  height: number = 630
): string {
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&enhance=true`;
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
    console.log('🎨 Generating image with Pollinations.ai (free alternative)...');

    // Generate prompt with text instructions
    const prompt = generateSDXLPrompt(eventType, metadata);
    
    // Use Pollinations.ai instead of Hugging Face
    const imageUrl = generateImageWithPollinations(prompt);

    console.log('✅ Image URL generated with Pollinations.ai!');
    return imageUrl;
  } catch (error) {
    console.error('❌ Failed to generate news image:', error);
    
    // Fallback to Hugging Face if Pollinations fails
    if (process.env.HUGGING_FACE_TOKEN) {
      try {
        console.log('🔄 Trying Hugging Face as fallback...');
        const imageBlob = await generateImage(prompt);
        const imageUrl = await uploadImageToStorage(imageBlob, newsId);
        console.log('✅ Fallback: Image generated with Hugging Face!');
        return imageUrl;
      } catch (hfError) {
        console.error('❌ Hugging Face fallback also failed:', hfError);
        return null;
      }
    }
    
    return null;
  }
}

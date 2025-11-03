import fs from 'fs';
import path from 'path';

/**
 * Server-side utility to get the correct player image URL
 * This avoids multiple failed requests by checking file existence on the server
 */
export function getPlayerImageUrl(playerId: string | number): string | null {
  if (typeof window !== 'undefined') {
    // Client-side fallback - just return webp extension
    return `/images/players/${playerId}.webp`;
  }

  try {
    const publicDir = path.join(process.cwd(), 'public', 'images', 'players');
    const extensions = ['webp', 'png', 'jpg', 'jpeg'];
    
    for (const ext of extensions) {
      const imagePath = path.join(publicDir, `${playerId}.${ext}`);
      if (fs.existsSync(imagePath)) {
        return `/images/players/${playerId}.${ext}`;
      }
    }
    
    return null; // No image found
  } catch (error) {
    console.error('Error checking player image:', error);
    return null;
  }
}

/**
 * Check if a player image exists
 */
export function hasPlayerImage(playerId: string | number): boolean {
  return getPlayerImageUrl(playerId) !== null;
}

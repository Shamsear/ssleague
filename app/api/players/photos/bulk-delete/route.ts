import { del, list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerIds, deleteAll } = body;

    if (deleteAll) {
      // Delete all player photos with pagination support
      let cursor: string | undefined;
      let allBlobs: any[] = [];
      const results: any[] = [];
      const errors: any[] = [];
      
      // Fetch all blobs (with pagination)
      do {
        const { blobs, cursor: nextCursor } = await list({
          prefix: 'player-photos/',
          cursor,
          limit: 1000, // Max per request
        });
        
        allBlobs.push(...blobs);
        cursor = nextCursor;
      } while (cursor);
      
      if (allBlobs.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No photos to delete',
          summary: { total: 0, success: 0, failed: 0 },
        });
      }

      // Delete in batches to avoid timeouts
      const batchSize = 50;
      for (let i = 0; i < allBlobs.length; i += batchSize) {
        const batch = allBlobs.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (blob) => {
            try {
              await del(blob.url);
              results.push({
                url: blob.url,
                success: true,
              });
            } catch (error: any) {
              errors.push({
                url: blob.url,
                error: error.message,
              });
            }
          })
        );
        
        // Log progress
        console.log(`Deleted ${Math.min(i + batchSize, allBlobs.length)}/${allBlobs.length} photos`);
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${results.length} photos${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        results,
        errors,
        summary: {
          total: allBlobs.length,
          success: results.length,
          failed: errors.length,
        },
      });
    }

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'playerIds array is required' },
        { status: 400 }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const playerId of playerIds) {
      try {
        // Find and delete photo for this player
        const { blobs } = await list({ prefix: `player-photos/${playerId}` });
        
        if (blobs.length > 0) {
          await del(blobs[0].url);
          results.push({
            playerId,
            success: true,
          });
          console.log(`✅ Deleted photo for player ${playerId}`);
        } else {
          results.push({
            playerId,
            success: true,
            message: 'No photo found',
          });
        }
      } catch (error: any) {
        errors.push({
          playerId,
          error: error.message,
        });
        console.error(`❌ Failed to delete photo for player ${playerId}:`, error);
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;

    return NextResponse.json({
      success: true,
      message: `Deleted ${successCount} photos${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      results,
      errors,
      summary: {
        total: playerIds.length,
        success: successCount,
        failed: errorCount,
      },
    });
  } catch (error: any) {
    console.error('❌ Bulk delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete photos',
      },
      { status: 500 }
    );
  }
}

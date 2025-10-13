import { NextRequest, NextResponse } from 'next/server';
import { unlink, readdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerIds, deleteAll } = body;

    const uploadDir = join(process.cwd(), 'public', 'images', 'players');

    if (deleteAll) {
      // Delete all player photos
      try {
        const files = await readdir(uploadDir);
        
        if (files.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No photos to delete',
            summary: { total: 0, success: 0, failed: 0 },
          });
        }

        const results = [];
        const errors = [];

        for (const file of files) {
          try {
            const filePath = join(uploadDir, file);
            await unlink(filePath);
            results.push({
              fileName: file,
              success: true,
            });
            console.log(`✅ Deleted photo: ${file}`);
          } catch (error: any) {
            errors.push({
              fileName: file,
              error: error.message,
            });
            console.error(`❌ Failed to delete ${file}:`, error);
          }
        }

        return NextResponse.json({
          success: true,
          message: `Deleted ${results.length} photos${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
          results,
          errors,
          summary: {
            total: files.length,
            success: results.length,
            failed: errors.length,
          },
        });
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return NextResponse.json({
            success: true,
            message: 'No photos directory found',
            summary: { total: 0, success: 0, failed: 0 },
          });
        }
        throw error;
      }
    }

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'playerIds array is required' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const playerId of playerIds) {
      try {
        // Try common extensions
        const extensions = ['jpg', 'jpeg', 'png', 'webp'];
        let deleted = false;

        for (const ext of extensions) {
          try {
            const filePath = join(uploadDir, `${playerId}.${ext}`);
            await unlink(filePath);
            results.push({
              playerId,
              success: true,
            });
            deleted = true;
            console.log(`✅ Deleted photo for player ${playerId}`);
            break;
          } catch (error: any) {
            if (error.code !== 'ENOENT') {
              throw error;
            }
          }
        }

        if (!deleted) {
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

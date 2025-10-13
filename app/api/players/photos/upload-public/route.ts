import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    // Ensure directory exists
    const uploadDir = join(process.cwd(), 'public', 'images', 'players');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        // Extract player_id from filename
        const fileName = file.name;
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const playerId = nameWithoutExt.replace(/^player_/i, '');
        
        const fileExtension = file.name.split('.').pop();
        const finalFileName = `${playerId}.${fileExtension}`;

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Write file to public folder
        const filePath = join(uploadDir, finalFileName);
        await writeFile(filePath, buffer);

        results.push({
          playerId,
          fileName: file.name,
          url: `/images/players/${finalFileName}`,
          success: true,
        });

        console.log(`✅ Saved photo for player ${playerId}`);
      } catch (error: any) {
        errors.push({
          fileName: file.name,
          error: error.message,
        });
        console.error(`❌ Failed to save ${file.name}:`, error);
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;

    return NextResponse.json({
      success: true,
      message: `Uploaded ${successCount} photos successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      results,
      errors,
      summary: {
        total: files.length,
        success: successCount,
        failed: errorCount,
      },
    });
  } catch (error: any) {
    console.error('❌ Bulk upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to upload photos',
      },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    const publicDir = path.join(process.cwd(), 'public', 'images', 'players');
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    
    for (const ext of extensions) {
      const imagePath = path.join(publicDir, `${playerId}.${ext}`);
      if (fs.existsSync(imagePath)) {
        return NextResponse.json({ 
          exists: true, 
          extension: ext,
          url: `/images/players/${playerId}.${ext}`
        });
      }
    }

    return NextResponse.json({ 
      exists: false,
      extension: null,
      url: null
    });
  } catch (error) {
    console.error('Error checking image existence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

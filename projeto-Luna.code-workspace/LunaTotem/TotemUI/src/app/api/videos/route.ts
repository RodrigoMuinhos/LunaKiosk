export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readVideos, sanitizeVideo } from './videoStore';

export async function GET() {
  try {
    const videos = await readVideos();
    return NextResponse.json({
      success: true,
      videos: videos.map(sanitizeVideo),
    });
  } catch (error) {
    console.error('Erro ao listar vídeos', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao listar vídeos.' },
      { status: 500 }
    );
  }
}

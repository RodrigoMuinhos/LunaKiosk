export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readVideos, sanitizeVideo } from '../videoStore';

export async function GET() {
  try {
    const videos = await readVideos();
    const activeVideos = videos
      .filter((video) => video.isActive || video.status === 'ACTIVE')
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return NextResponse.json({
      success: true,
      videos: activeVideos.map(sanitizeVideo),
    });
  } catch (error) {
    console.error('Erro ao carregar vídeos ativos', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao carregar vídeos ativos.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { videos } = await request.json();

    if (!videos || !Array.isArray(videos)) {
      return NextResponse.json(
        { error: 'Lista de vídeos inválida' },
        { status: 400 }
      );
    }

    // Caminho do arquivo de playlist
    const playlistPath = path.join(process.cwd(), 'data', 'video-playlist.json');

    // Garantir que o diretório existe
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });

    // Salvar a playlist
    await fs.writeFile(
      playlistPath,
      JSON.stringify({ videos, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );

    return NextResponse.json({
      success: true,
      message: 'Playlist salva com sucesso',
      count: videos.length
    });

  } catch (error) {
    console.error('Erro ao salvar playlist:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar playlist' },
      { status: 500 }
    );
  }
}

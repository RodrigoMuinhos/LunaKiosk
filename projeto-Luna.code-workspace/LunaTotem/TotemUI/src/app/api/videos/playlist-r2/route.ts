/**
 * GET /api/videos/playlist-r2
 * 
 * Retorna lista de vídeos do Cloudflare R2 no formato esperado pelo totem.
 * Os vídeos são servidos diretamente do R2 com cache do navegador.
 */

export const dynamic = 'force-dynamic';

interface R2Video {
  id: string;
  url: string;
  title: string;
  duration?: number;
  sizeBytes?: number;
}

export async function GET() {
  try {
    // Tentar carregar playlist do arquivo JSON (gerenciada pelo admin)
    try {
      const fs = require('fs/promises');
      const path = require('path');
      const playlistPath = path.join(process.cwd(), 'data', 'video-playlist.json');
      const fileContent = await fs.readFile(playlistPath, 'utf-8');
      const playlist = JSON.parse(fileContent);
      
      if (playlist.videos && Array.isArray(playlist.videos)) {
        return Response.json({
          success: true,
          videos: playlist.videos,
          count: playlist.videos.length,
          source: 'admin-managed'
        });
      }
    } catch (fileError) {
      // Se não conseguir ler o arquivo, usa a lista padrão abaixo
      console.log('Usando playlist padrão (arquivo não encontrado)');
    }

    // 🎬 VÍDEOS REAIS DO R2 - Lista dos 5 vídeos hospedados
    const R2_BASE_URL = 'https://pub-59812e445a4c4fd38663f7cb852f3c24.r2.dev';
    const videos: R2Video[] = [
      {
        id: 'video-001',
        url: `${R2_BASE_URL}/Videos/5Motivos.mp4`,
        title: '5 Motivos para Cuidar da Saúde Íntima',
        sizeBytes: 86210000,
      },
      {
        id: 'video-002',
        url: `${R2_BASE_URL}/Videos/Microscópio.mp4`,
        title: 'Microscópio',
        sizeBytes: 53790000,
      },
      {
        id: 'video-003',
        url: `${R2_BASE_URL}/Videos/fraxx.mp4`,
        title: 'Fraxx',
        sizeBytes: 50480000,
      },
      {
        id: 'video-004',
        url: `${R2_BASE_URL}/Videos/menopausa.mp4`,
        title: 'Menopausa',
        sizeBytes: 47260000,
      },
      {
        id: 'video-005',
        url: `${R2_BASE_URL}/Videos/pH%20Vaginal.mp4`,
        title: 'pH Vaginal',
        sizeBytes: 59020000,
      },
    ];

    return Response.json({
      success: true,
      videos,
      source: 'cloudflare-r2',
      cacheControl: 'public, max-age=3600', // Cache por 1 hora
    });
  } catch (error) {
    console.error('Erro ao buscar playlist R2:', error);
    return Response.json(
      {
        success: false,
        error: 'Erro ao buscar vídeos do R2',
        videos: [],
      },
      { status: 500 }
    );
  }
}

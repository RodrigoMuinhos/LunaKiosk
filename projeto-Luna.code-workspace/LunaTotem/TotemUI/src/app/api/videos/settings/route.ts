export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { readVideoSettings, writeVideoSettings } from '../settingsStore';

function isWindowsAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function isAbsoluteLike(value: string) {
  return path.isAbsolute(value) || isWindowsAbsolutePath(value);
}

export async function GET() {
  try {
    const settings = await readVideoSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Erro ao ler configurações de vídeo', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao ler configurações de vídeo.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();

    const desiredSource = payload?.source === 'folder' ? 'folder' : 'uploads';
    const desiredFolderPath =
      typeof payload?.folderPath === 'string' ? payload.folderPath.trim() : payload?.folderPath === null ? '' : '';

    if (desiredSource === 'folder') {
      // Require absolute local paths to avoid surprises with relative cwd.
      if (!desiredFolderPath) {
        return NextResponse.json(
          { success: false, error: 'Informe o caminho da pasta.' },
          { status: 400 }
        );
      }
      if (!isAbsoluteLike(desiredFolderPath)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'O caminho da pasta deve ser absoluto (ex: C:\\LunaKiosk\\videos).',
          },
          { status: 400 }
        );
      }

      // Em Vercel/Linux não há como validar/ler C:\\...; permitimos salvar para o kiosk usar.
      if (process.platform === 'win32') {
        try {
          const stat = await fs.stat(desiredFolderPath);
          if (!stat.isDirectory()) {
            return NextResponse.json(
              { success: false, error: 'O caminho informado não é uma pasta.' },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: 'Pasta não encontrada ou sem permissão de acesso.' },
            { status: 400 }
          );
        }
      }
    }

    const settings = await writeVideoSettings({
      source: desiredSource,
      folderPath: desiredSource === 'folder' ? desiredFolderPath : null,
      inactivityMinutes: payload?.inactivityMinutes,
    });
    const warning =
      desiredSource === 'folder' && process.platform !== 'win32'
        ? 'Modo pasta local funciona apenas no kiosk (Windows). Em Vercel o servidor não consegue ler C:\\...'
        : undefined;
    return NextResponse.json({ success: true, settings, warning });
  } catch (error) {
    console.error('Erro ao salvar configurações de vídeo', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao salvar configurações de vídeo.' },
      { status: 500 }
    );
  }
}

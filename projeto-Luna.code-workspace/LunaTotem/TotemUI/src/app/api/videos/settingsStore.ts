import { promises as fs } from 'fs';
import path from 'path';

export type VideoSource = 'uploads' | 'folder';

export interface VideoSettings {
  source: VideoSource;
  /** Absolute path on the kiosk machine (Windows/Linux/macOS). */
  folderPath: string | null;
  /** Minutes until returning to rest mode (1..5). */
  inactivityMinutes: number;
  updatedAt: string;
}

// In the Electron kiosk (packaged), process.cwd() can point to a read-only directory.
// Allow overriding where we persist JSON data.
function getWritableDataDir() {
  if (process.env.KIOSK_DATA_DIR) {
    return path.resolve(process.env.KIOSK_DATA_DIR);
  }

  // Serverless providers (ex: Vercel) typically run on read-only filesystem.
  // Use OS temp directory so PUT /settings doesn't fail with 500.
  const isServerless =
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.LAMBDA_TASK_ROOT;

  if (isServerless) {
    const tmpBase =
      process.env.TMPDIR ||
      process.env.TEMP ||
      process.env.TMP ||
      (process.platform === 'win32' ? process.cwd() : '/tmp');
    return path.join(tmpBase, 'luna-kiosk-data');
  }

  return path.join(process.cwd(), 'data');
}

const DATA_DIR = getWritableDataDir();
const DATA_FILE = path.join(DATA_DIR, 'video-settings.json');

const DEFAULT_SETTINGS: VideoSettings = {
  source: 'uploads',
  folderPath: null,
  inactivityMinutes: 3,
  updatedAt: new Date(0).toISOString(),
};

async function ensureSettingsFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
  }
}

function clampMinutes(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.inactivityMinutes;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export async function readVideoSettings(): Promise<VideoSettings> {
  await ensureSettingsFile();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<VideoSettings>;

    const source: VideoSource = parsed.source === 'folder' ? 'folder' : 'uploads';
    const folderPathRaw = typeof parsed.folderPath === 'string' ? parsed.folderPath.trim() : '';
    const folderPath = folderPathRaw ? folderPathRaw : null;

    return {
      source,
      folderPath,
      inactivityMinutes: clampMinutes(parsed.inactivityMinutes),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : DEFAULT_SETTINGS.updatedAt,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeVideoSettings(patch: Partial<VideoSettings>): Promise<VideoSettings> {
  const current = await readVideoSettings();
  const source: VideoSource = patch.source === 'folder' ? 'folder' : patch.source === 'uploads' ? 'uploads' : current.source;
  const folderPathRaw = typeof patch.folderPath === 'string' ? patch.folderPath.trim() : patch.folderPath === null ? '' : null;
  const folderPath = folderPathRaw === null ? current.folderPath : folderPathRaw ? folderPathRaw : null;

  const next: VideoSettings = {
    ...current,
    source,
    folderPath,
    inactivityMinutes: patch.inactivityMinutes === undefined ? current.inactivityMinutes : clampMinutes(patch.inactivityMinutes),
    updatedAt: new Date().toISOString(),
  };

  await ensureSettingsFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// In the Electron kiosk (packaged), process.cwd() can point to a read-only directory.
// Allow overriding where we persist JSON data.
const DATA_DIR = process.env.KIOSK_DATA_DIR
  ? path.resolve(process.env.KIOSK_DATA_DIR)
  : path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'videos.json');

export type VideoStatus = 'PENDING' | 'PROCESSING' | 'ACTIVE' | 'ARCHIVED' | 'ERROR';

export interface VideoRecord {
  id: string;
  filename: string;
  originalName?: string;
  title?: string;
  description?: string;
  filePath: string;
  fileSize: number;
  displayOrder: number;
  isActive: boolean;
  status: VideoStatus;
  createdAt: string;
  updatedAt: string;
}

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
  }
}

export async function readVideos(): Promise<VideoRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as VideoRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeVideos(videos: VideoRecord[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(videos, null, 2), 'utf-8');
}

export function createVideoId() {
  return randomUUID();
}

export function sanitizeVideo(video: VideoRecord) {
  const { originalName, ...rest } = video;
  return rest;
}

export function normalizeDisplayOrder(videos: VideoRecord[]) {
  return videos
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((video, index) => ({ ...video, displayOrder: index + 1 }));
}

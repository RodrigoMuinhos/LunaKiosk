import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');
const tefDir = path.join(repoRoot, 'LunaKiosk', 'tef-bridge');
const printDir = path.join(repoRoot, 'LunaKiosk', 'print-bridge');
const dataDir = path.join(root, '..', 'data');
const pidsFile = path.join(dataDir, 'bridges.pids.json');

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function waitHealth(url: string, timeoutMs: number): Promise<boolean> {
  const gfetch = (globalThis as any).fetch as (input: any, init?: any) => Promise<any>;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await gfetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch {}
    await sleep(400);
  }
  return false;
}

async function ensureBridge(name: string, cwd: string, url: string): Promise<number> {
  // If already healthy, don't spawn
  if (await waitHealth(url, 1500)) return -1;

  const child = spawn('node', ['--enable-source-maps', '--loader', 'ts-node/esm', 'src/index.ts'], {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  const ok = await waitHealth(url, 8000);
  if (!ok) throw new Error(`${name} did not become healthy at ${url}`);
  return child.pid ?? -1;
}

async function main() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const pids: Record<string, number> = {};
  const tefPid = await ensureBridge('tef-bridge', tefDir, 'http://127.0.0.1:7071/api/health');
  if (tefPid > 0) pids['tef-bridge'] = tefPid;
  const printPid = await ensureBridge('print-bridge', printDir, 'http://127.0.0.1:7072/api/health');
  if (printPid > 0) pids['print-bridge'] = printPid;
  writeFileSync(pidsFile, JSON.stringify(pids, null, 2));
  // eslint-disable-next-line no-console
  console.log('[startBridges] ok', pids);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[startBridges] error', e);
  process.exit(1);
});

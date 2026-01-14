import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function repoRootFromHere() {
  // kiosk-electron/scripts -> kiosk-electron -> LunaKiosk -> projeto-Luna.code-workspace -> OrquestradorLuna(root)
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function statSafe(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listJars(targetDir) {
  const st = statSafe(targetDir);
  if (!st || !st.isDirectory()) return [];

  return fs
    .readdirSync(targetDir)
    .filter((f) => f.toLowerCase().endsWith('.jar'))
    .filter((f) => !f.toLowerCase().endsWith('.jar.original'))
    .map((f) => path.join(targetDir, f));
}

function pickBestJar(jars) {
  if (!jars.length) return null;
  // pick newest mtime; tie-breaker by size
  const scored = jars
    .map((p) => {
      const st = fs.statSync(p);
      return { p, mtimeMs: st.mtimeMs, size: st.size };
    })
    .sort((a, b) => (b.mtimeMs - a.mtimeMs) || (b.size - a.size));

  return scored[0].p;
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function syncOne({ name, fromTargetDir, destDir }) {
  const jars = listJars(fromTargetDir);
  const jar = pickBestJar(jars);
  if (!jar) {
    throw new Error(`[sync-backend] Nenhum .jar encontrado em: ${fromTargetDir}`);
  }

  const dest = path.join(destDir, path.basename(jar));
  copyFile(jar, dest);
  return { name, src: jar, dest };
}

function main() {
  const repoRoot = repoRootFromHere();
  const electronDir = path.resolve(__dirname, '..');
  const destDir = path.join(electronDir, 'backend-jars');
  ensureDir(destDir);

  const items = [
    {
      name: 'lunacore',
      fromTargetDir: path.join(repoRoot, 'projeto-Luna.code-workspace', 'LunaCore', 'lunacore', 'target')
    },
    {
      name: 'totemapi',
      fromTargetDir: path.join(repoRoot, 'projeto-Luna.code-workspace', 'LunaTotem', 'TotemAPI', 'target')
    },
    {
      name: 'lunapay',
      fromTargetDir: path.join(repoRoot, 'projeto-Luna.code-workspace', 'LunaPay', 'lunapay-api', 'target')
    }
  ];

  const results = items.map((it) => syncOne({ ...it, destDir }));

  // eslint-disable-next-line no-console
  console.log('[sync-backend] OK');
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(` - ${r.name}: ${r.src} -> ${r.dest}`);
  }
}

main();

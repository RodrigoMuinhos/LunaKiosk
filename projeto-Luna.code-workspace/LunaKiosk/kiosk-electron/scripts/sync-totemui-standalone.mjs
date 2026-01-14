import fs from 'fs';
import path from 'path';
import url from 'url';
import { spawnSync } from 'child_process';

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

function rmDirSafe(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(srcDir, destDir) {
  const st = statSafe(srcDir);
  if (!st || !st.isDirectory()) {
    throw new Error(`[sync-totemui] Diretório não encontrado: ${srcDir}`);
  }

  ensureDir(destDir);

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const ent of entries) {
    const src = path.join(srcDir, ent.name);
    const dest = path.join(destDir, ent.name);

    if (ent.isDirectory()) {
      copyDirRecursive(src, dest);
    } else if (ent.isFile()) {
      copyFile(src, dest);
    }
  }
}

function run(cmd, args, cwd, env) {
  const isWin = process.platform === 'win32';

  // Em Windows, rodar diretamente "npm.cmd" com shell=false pode falhar (EINVAL) em alguns ambientes.
  // Usamos cmd.exe para garantir compatibilidade.
  const result = isWin
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', [cmd, ...(args || [])].join(' ')], {
        cwd,
        env,
        stdio: 'inherit'
      })
    : spawnSync(cmd, args, {
        cwd,
        env,
        stdio: 'inherit',
        shell: false
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`[sync-totemui] comando falhou: ${cmd} ${args.join(' ')} (exit=${result.status})`);
  }
}

function main() {
  const repoRoot = repoRootFromHere();
  const electronDir = path.resolve(__dirname, '..');
  const totemUiDir = path.join(repoRoot, 'projeto-Luna.code-workspace', 'LunaTotem', 'TotemUI');
  const destStandaloneDir = path.join(electronDir, 'next-standalone');

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  // Build do TotemUI com o API local (kiosk). Importante: NEXT_PUBLIC_* é embutido no bundle.
  const buildEnv = {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  };

  // eslint-disable-next-line no-console
  console.log(`[sync-totemui] build TotemUI: ${totemUiDir}`);
  run(npmCmd, ['run', 'build'], totemUiDir, buildEnv);

  const srcStandalone = path.join(totemUiDir, '.next', 'standalone');
  const srcStatic = path.join(totemUiDir, '.next', 'static');
  const srcPublic = path.join(totemUiDir, 'public');

  const stStandalone = statSafe(srcStandalone);
  if (!stStandalone || !stStandalone.isDirectory()) {
    throw new Error(`[sync-totemui] build não gerou .next/standalone em: ${srcStandalone}`);
  }

  // eslint-disable-next-line no-console
  console.log(`[sync-totemui] sync -> ${destStandaloneDir}`);

  rmDirSafe(destStandaloneDir);
  ensureDir(destStandaloneDir);

  // Copia o conteúdo do standalone para o destino.
  copyDirRecursive(srcStandalone, destStandaloneDir);

  // Copia assets estáticos.
  const destStatic = path.join(destStandaloneDir, '.next', 'static');
  rmDirSafe(destStatic);
  copyDirRecursive(srcStatic, destStatic);

  // Copia public/ (imagens etc)
  const destPublic = path.join(destStandaloneDir, 'public');
  rmDirSafe(destPublic);
  copyDirRecursive(srcPublic, destPublic);

  // Copia .env.production do TotemUI como referência (não contém segredos).
  const envProd = path.join(totemUiDir, '.env.production');
  if (statSafe(envProd)?.isFile()) {
    copyFile(envProd, path.join(destStandaloneDir, '.env.production'));
  }

  // eslint-disable-next-line no-console
  console.log('[sync-totemui] OK');
}

main();

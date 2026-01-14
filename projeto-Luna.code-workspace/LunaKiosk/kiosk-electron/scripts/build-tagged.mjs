import { spawnSync } from 'node:child_process';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function makeBuildTag(d = new Date()) {
  // YYYYMMDD-HHMMSS (lexicographically sortable)
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function makePatchId(d = new Date()) {
  // Technical patch id: same as BUILD_TAG by default (unique + sortable)
  return makeBuildTag(d);
}

function runOrThrow(command, env) {
  // Use cmd.exe to be maximally compatible on Windows (avoids spawn EINVAL issues).
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
    stdio: 'inherit',
    env,
    windowsHide: false,
  });

  if (r.status !== 0) {
    throw new Error(`Command failed (exit=${r.status}): ${command}`);
  }
}

const now = new Date();
const tag = process.env.BUILD_TAG?.trim() || makeBuildTag(now);
const patchId = process.env.PATCH_ID?.trim() || makePatchId(now);
const env = {
  ...process.env,
  BUILD_TAG: tag,
  PATCH_ID: patchId,
};

console.log(`\n[build-tagged] BUILD_TAG=${tag}`);
console.log(`[build-tagged] PATCH_ID=${patchId}\n`);

runOrThrow('npm run sync:jre', env);
runOrThrow('npm run sync:backend', env);
runOrThrow('npm run sync:totemui', env);
runOrThrow('npm run verify:artifacts', env);
runOrThrow('electron-builder --win --x64', env);

console.log(`\n[build-tagged] Done. Check dist/ for files containing: ${tag}\n`);

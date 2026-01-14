import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function runNode(cwd: string, entry: string) {
  const child = spawn('node', ['--enable-source-maps', '--loader', 'ts-node/esm', entry], {
    cwd,
    stdio: 'inherit',
    windowsHide: true
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const coreDir = path.resolve(__dirname, '..');
  // Start bridges first
  runNode(coreDir, 'scripts/startBridges.ts');

  // If KIOSK_V2_ENABLED=false, we don't start V2 engine here (legacy remains)
  const flag = (process.env.KIOSK_V2_ENABLED ?? 'false').toLowerCase() === 'true';
  if (flag) {
    // give bridges a moment to start and write pids
    setTimeout(() => runNode(coreDir, 'src/kiosk-v2/entry.ts'), 500);
  } else {
    // eslint-disable-next-line no-console
    console.log('[startAll] KIOSK_V2_ENABLED=false -> not starting V2 engine. Legacy remains intact.');
  }
}

main();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findFirstMatch(dir, re) {
  try {
    if (!isDir(dir)) return null;
    const entries = fs.readdirSync(dir);
    const found = entries.find((e) => re.test(e));
    return found ? path.join(dir, found) : null;
  } catch {
    return null;
  }
}

function fail(msg) {
  console.error(`[verify-artifacts] ERROR: ${msg}`);
  process.exitCode = 1;
}

const projectDir = path.resolve(__dirname, '..');
const nextStandaloneDir = path.join(projectDir, 'next-standalone');
const nextServer = path.join(nextStandaloneDir, 'server.js');
const nextStaticDir = path.join(nextStandaloneDir, '.next', 'static');

const backendJarsDir = path.join(projectDir, 'backend-jars');
const lunacoreJar = findFirstMatch(backendJarsDir, /^lunacore-.*\.jar$/i);
const totemapiJar = findFirstMatch(backendJarsDir, /^totem-api-.*\.jar$/i);
const lunapayJar = findFirstMatch(backendJarsDir, /^lunapay-.*\.jar$/i);

const jreJava = path.join(projectDir, 'resources', 'jre', 'bin', 'java.exe');

console.log(`[verify-artifacts] projectDir=${projectDir}`);

if (!exists(nextStandaloneDir) || !isDir(nextStandaloneDir)) {
  fail(`Pasta next-standalone ausente: ${nextStandaloneDir}`);
} else {
  if (!exists(nextServer)) {
    fail(`TotemUI standalone ausente: ${nextServer}`);
  }
  if (!exists(nextStaticDir) || !isDir(nextStaticDir)) {
    fail(`TotemUI static ausente: ${nextStaticDir}`);
  }
}

if (!exists(backendJarsDir) || !isDir(backendJarsDir)) {
  fail(`Pasta backend-jars ausente: ${backendJarsDir}`);
} else {
  if (!lunacoreJar) fail(`JAR do LunaCore nao encontrado em ${backendJarsDir} (esperado lunacore-*.jar)`);
  if (!totemapiJar) fail(`JAR do TotemAPI nao encontrado em ${backendJarsDir} (esperado totem-api-*.jar)`);
  if (!lunapayJar) fail(`JAR do LunaPay nao encontrado em ${backendJarsDir} (esperado lunapay-*.jar)`);
}

if (!exists(jreJava)) {
  fail(`JRE embutido ausente: ${jreJava}`);
}

if (process.exitCode) {
  console.error('\n[verify-artifacts] Falha. Dicas:');
  console.error('- Rode: npm run sync:totemui');
  console.error('- Rode: npm run sync:backend');
  console.error('- Rode: npm run sync:jre');
  console.error('- Depois: npm run build');
} else {
  console.log('[verify-artifacts] OK - artefatos essenciais presentes.');
  console.log(`[verify-artifacts] nextServer=${nextServer}`);
  console.log(`[verify-artifacts] lunacoreJar=${lunacoreJar}`);
  console.log(`[verify-artifacts] totemapiJar=${totemapiJar}`);
  console.log(`[verify-artifacts] lunapayJar=${lunapayJar}`);
  console.log(`[verify-artifacts] jreJava=${jreJava}`);
}

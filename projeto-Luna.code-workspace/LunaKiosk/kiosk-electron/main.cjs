const { app, BrowserWindow, session } = require('electron');
const { dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const dotenv = require('dotenv');
const net = require('net');
let logsDir;
let logFileStream;
let embeddedJavaPath;
let bootstrapLogPath;
let loadedEnvFilePath;
let loadedEnvLabel;

// Em algumas mÃ¡quinas Windows, o cache do Chromium/GPU pode falhar com "Acesso negado".
// ForÃ§amos um diretÃ³rio de userData/cache claramente gravÃ¡vel (LOCALAPPDATA) antes do app ficar ready.
try {
  bootstrapLog('bootstrap: configuring userData/cache');
  const baseDir = process.env.KIOSK_USERDATA_DIR
    ? String(process.env.KIOSK_USERDATA_DIR)
    : process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'LunaKiosk')
      : path.join(app.getPath('temp'), 'LunaKiosk');

  const userDataDir = path.join(baseDir, 'userData');
  fs.mkdirSync(userDataDir, { recursive: true });
  app.setPath('userData', userDataDir);
  logsDir = path.join(baseDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  logFileStream = fs.createWriteStream(path.join(logsDir, 'launcher.log'), { flags: 'a' });
  bootstrapLog(`bootstrap: logsDir=${logsDir}`);

  // Usa um cache por execução para evitar problemas ao mover/renomear cache antigo (Acesso negado).
  const chromiumCacheDir = path.join(userDataDir, 'chromium-cache', String(process.pid));
  fs.mkdirSync(chromiumCacheDir, { recursive: true });

  // Alguns erros em Windows acontecem no diretório de cache (separado de userData).
  // Mantemos ambos apontando para um local gravável.
  try {
    app.setPath('cache', chromiumCacheDir);
  } catch {
    // ignore
  }

  app.commandLine.appendSwitch('disk-cache-dir', chromiumCacheDir);
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

  // Escape hatch: disable GPU (útil em máquinas com drivers/ACLs problemáticos)
  if (String(process.env.KIOSK_DISABLE_GPU || '').toLowerCase() === 'true') {
    try {
      app.disableHardwareAcceleration();
    } catch {
      // ignore
    }
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
  }
} catch (e) {
  bootstrapLog(`bootstrap: failed to configure userData/cache: ${String(e?.message || e)}`);
}

// Por padrão, o app deve abrir no Totem (boas-vindas). O CRM/admin fica em /system.
const KIOSK_START_URL = process.env.KIOSK_START_URL || '/';
const KIOSK_PORT = Number.parseInt(process.env.KIOSK_PORT || '19007', 10);
// Default para localhost (muitos backends só liberam CORS para localhost e não para 127.0.0.1)
const KIOSK_HOST = process.env.KIOSK_HOST || 'localhost';
const ELECTRON_RENDERER_URL = process.env.ELECTRON_RENDERER_URL;

let kioskPortRuntime = KIOSK_PORT;

const LOCAL_HOST = '127.0.0.1';
let LUNACORE_PORT = Number.parseInt(process.env.LUNACORE_PORT || '8080', 10);
let TOTEMAPI_PORT = Number.parseInt(process.env.TOTEMAPI_PORT || '8081', 10);
let LUNAPAY_PORT = Number.parseInt(process.env.LUNAPAY_PORT || '8082', 10);

let mainWindow;

let serverProcess;

// Em Windows é comum o usuário (ou o instalador) disparar o app mais de uma vez.
// Se criarmos a janela “cedo demais”, ela tenta abrir http://localhost:19007 antes do TotemUI estar de pé.
// Mantemos um estado/promise de startup para que o second-instance espere o TotemUI subir.
let startupPromise;
let startupDone = false;

const backendPorts = {
  lunacore: LUNACORE_PORT,
  totemapi: TOTEMAPI_PORT,
  lunapay: LUNAPAY_PORT
};
const backendProcesses = new Map();

function initBootstrapLog() {
  if (bootstrapLogPath) return bootstrapLogPath;
  const candidates = [];
  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'LunaKiosk'));
  }
  if (process.execPath) {
    candidates.push(path.dirname(process.execPath));
  }
  if (process.env.TEMP) {
    candidates.push(path.join(process.env.TEMP, 'LunaKiosk'));
  }
  candidates.push(process.cwd());

  for (const baseDir of candidates) {
    const logDir = path.join(baseDir, 'logs');
    try {
      fs.mkdirSync(logDir, { recursive: true });
      bootstrapLogPath = path.join(logDir, 'bootstrap.log');
      break;
    } catch {
      // try next candidate
    }
  }
  if (!bootstrapLogPath) {
    bootstrapLogPath = path.join(process.cwd(), 'bootstrap.log');
  }
  return bootstrapLogPath;
}

function bootstrapLog(message) {
  const target = initBootstrapLog();
  try {
    fs.appendFileSync(target, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // ignore
  }
}

bootstrapLog(`bootstrap: main loaded execPath=${process.execPath} resourcesPath=${process.resourcesPath} isPackaged=${app.isPackaged}`);

function installCorsWorkaround() {
  // Em Electron, a UI (Next) roda em um origin diferente das APIs (8080/8081/8082).
  // Se os backends não tiverem CORS liberado para a porta do kiosk, isso pode virar “tela branca”.
  // Como o app é local/kiosk, injetamos headers CORS nas respostas dessas APIs.
  // Pode ser desligado com KIOSK_DISABLE_CORS_WORKAROUND=true.
  if (String(process.env.KIOSK_DISABLE_CORS_WORKAROUND || '').toLowerCase() === 'true') return;

  try {
    const ses = session.defaultSession;
    if (!ses || !ses.webRequest) return;

    const ports = [backendPorts.lunacore, backendPorts.totemapi, backendPorts.lunapay];
    const urls = [];
    for (const port of ports) {
      urls.push(`http://localhost:${port}/*`);
      urls.push(`http://127.0.0.1:${port}/*`);
    }

    const filter = { urls };

    ses.webRequest.onHeadersReceived(filter, (details, callback) => {
      try {
        const responseHeaders = details.responseHeaders || {};

        // Preserva o origin real quando possível.
        const requestOrigin =
          (details.requestHeaders && (details.requestHeaders.Origin || details.requestHeaders.origin)) ||
          `http://${KIOSK_HOST}:${kioskPortRuntime}`;

        responseHeaders['Access-Control-Allow-Origin'] = [String(requestOrigin)];
        responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
        responseHeaders['Access-Control-Allow-Methods'] = ['GET,POST,PUT,PATCH,DELETE,OPTIONS'];
        responseHeaders['Access-Control-Allow-Headers'] = ['Authorization,Content-Type,Accept,Origin,X-Requested-With'];

        callback({ responseHeaders });
      } catch {
        callback({ responseHeaders: details.responseHeaders });
      }
    });

    logLine('[cors] workaround habilitado (injetando headers para APIs locais)');
  } catch (e) {
    logLine(`[cors] falha ao instalar workaround: ${String(e?.message || e)}`);
  }
}

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    process.stdout.write(line);
  } catch {
    // ignore
  }
  try {
    if (logFileStream) {
      logFileStream.write(line);
    } else {
      bootstrapLog(message);
    }
  } catch {
    bootstrapLog(message);
  }
}

function getLogsDir() {
  let dir = logsDir;
  if (!dir) {
    try {
      dir = path.join(path.dirname(app.getPath('userData')), 'logs');
    } catch {
      dir = path.join(process.cwd(), 'logs');
    }
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return dir;
}

function updateBackendPorts(ports) {
  if (!Array.isArray(ports) || ports.length < 3) return;
  LUNACORE_PORT = ports[0];
  TOTEMAPI_PORT = ports[1];
  LUNAPAY_PORT = ports[2];

  backendPorts.lunacore = LUNACORE_PORT;
  backendPorts.totemapi = TOTEMAPI_PORT;
  backendPorts.lunapay = LUNAPAY_PORT;

  process.env.LUNACORE_PORT = String(LUNACORE_PORT);
  process.env.TOTEMAPI_PORT = String(TOTEMAPI_PORT);
  process.env.LUNAPAY_PORT = String(LUNAPAY_PORT);
}


function getEmbeddedJavaPath() {
  const javaPath = path.join(process.resourcesPath, 'jre', 'bin', 'java.exe');
  if (!fs.existsSync(javaPath)) {
    throw new Error(`JRE embutido nao encontrado: ${javaPath}`);
  }
  return javaPath;
}

function readJavaMajorVersion(javaPath) {
  const result = spawnSync(javaPath, ['-version'], { encoding: 'utf-8' });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const output = `${stdout}
${stderr}`.trim();
  const match = output.match(/version "(\d+)(?:\.|")/i);
  const major = match ? Number.parseInt(match[1], 10) : null;
  return { major, output };
}

function validateEmbeddedJava21OrThrow() {
  const javaPath = getEmbeddedJavaPath();
  const info = readJavaMajorVersion(javaPath);
  if (info.major !== 21) {
    const msg = `Java embutido invalido.
` +
      `Esperado Java 21, encontrado: ${info.major || 'desconhecido'}.
` +
      `Caminho: ${javaPath}
` +
      `Saida do java -version:
${info.output || 'sem saida'}`;
    throw new Error(msg);
  }
  embeddedJavaPath = javaPath;
  return javaPath;
}

async function checkPortsInUse(ports) {
  const checks = await Promise.all(ports.map((port) => isTcpPortOpen(LOCAL_HOST, port)));
  return ports.filter((port, idx) => checks[idx]);
}

async function resolveBackendPortsAuto() {
  const basePorts = [LUNACORE_PORT, TOTEMAPI_PORT, LUNAPAY_PORT];
  const inUse = await checkPortsInUse(basePorts);
  if (!inUse.length) {
    return { ports: basePorts, usedFallback: false, inUse: [] };
  }

  const fallbackBase = Number.parseInt(process.env.KIOSK_FALLBACK_BASE || '18080', 10);
  const base = basePorts[0];
  const fallbackPorts = basePorts.map((port) => fallbackBase + (port - base));
  const fallbackInUse = await checkPortsInUse(fallbackPorts);

  if (fallbackInUse.length) {
    const msg = `Portas em uso: ${inUse.join(', ')}. ` +
      `Fallback tambem ocupado: ${fallbackInUse.join(', ')}`;
    throw new Error(msg);
  }

  return { ports: fallbackPorts, usedFallback: true, inUse };
}

async function showStartupError(details) {
  const logsPath = getLogsDir();
  const report = writeStartupFailureReport(details);
  const reportPath = report?.reportPath;
  const dialogDetails =
    `${details}\n\n` +
    (reportPath ? `Relatorio completo: ${reportPath}\n` : '') +
    `Pasta de logs: ${logsPath}`;
  const result = await dialog.showMessageBox({
    type: 'error',
    buttons: ['Abrir logs', 'Fechar'],
    defaultId: 0,
    cancelId: 1,
    title: 'Falha ao iniciar',
    message: 'Nao foi possivel iniciar o LunaKiosk.',
    detail: dialogDetails
  });

  if (result.response === 0) {
    try {
      shell.openPath(logsPath);
    } catch {
      // ignore
    }
  }
}

function isoFileStamp(d = new Date()) {
  // YYYYMMDD-HHMMSS (seguro para nomes de arquivo no Windows)
  const pad2 = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function isSecretKey(name) {
  const n = String(name || '').toUpperCase();
  return (
    n.includes('SECRET') ||
    n.includes('TOKEN') ||
    n.includes('PASSWORD') ||
    n.includes('API_KEY') ||
    n === 'JWT_SECRET' ||
    n.endsWith('_KEY')
  );
}

function redactEnvValue(name, value) {
  if (value === undefined || value === null) return value;
  const s = String(value);
  if (!isSecretKey(name)) return s;
  if (s.length <= 8) return `*** (len=${s.length})`;
  return `${s.slice(0, 4)}***${s.slice(-4)} (len=${s.length})`;
}

function collectRelevantEnvSnapshot() {
  const prefixes = ['KIOSK_', 'ASAAS_', 'SPRING_', 'LUNACORE_', 'TOTEMAPI_', 'LUNAPAY_', 'NEXT_PUBLIC_', 'ELECTRON_'];
  const out = {};
  for (const [k, v] of Object.entries(process.env || {})) {
    if (prefixes.some((p) => k.startsWith(p)) || k === 'JWT_SECRET' || k === 'NODE_ENV') {
      out[k] = redactEnvValue(k, v);
    }
  }
  if (loadedEnvFilePath) out.__ENV_LOADED_PATH = loadedEnvFilePath;
  if (loadedEnvLabel) out.__ENV_LOADED_LABEL = loadedEnvLabel;
  return out;
}

function tailTextFile(filePath, maxBytes = 64 * 1024) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const size = stat.size;
    const start = Math.max(0, size - maxBytes);
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf.toString('utf-8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (e) {
    return `<<falha ao ler ${filePath}: ${String(e?.message || e)}>>`;
  }
}

function safeExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function writeStartupFailureReport(details) {
  // Nao use API async aqui: queremos garantir gravacao mesmo com falhas no loop.
  const logsPath = getLogsDir();
  const stamp = isoFileStamp();
  const reportPath = path.join(logsPath, `startup-failure-${stamp}.md`);

  const standaloneDir = (() => {
    try {
      return getStandaloneDir();
    } catch {
      return null;
    }
  })();
  const serverEntry = standaloneDir ? path.join(standaloneDir, 'server.js') : null;
  const backendDir = (() => {
    try {
      return getBackendJarsDir();
    } catch {
      return null;
    }
  })();
  const jreJava = path.join(process.resourcesPath || '', 'jre', 'bin', 'java.exe');

  const logFiles = [];
  const launcherLog = path.join(logsPath, 'launcher.log');
  const totemuiLog = path.join(logsPath, 'totemui.log');
  if (safeExists(launcherLog)) logFiles.push(launcherLog);
  if (safeExists(totemuiLog)) logFiles.push(totemuiLog);
  if (backendDir) {
    const backendLogsDir = path.join(backendDir, 'logs');
    try {
      if (safeExists(backendLogsDir)) {
        const entries = fs.readdirSync(backendLogsDir);
        for (const name of entries) {
          if (name.toLowerCase().endsWith('.log')) {
            logFiles.push(path.join(backendLogsDir, name));
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const checks = {
    isPackaged: !!app.isPackaged,
    execPath: process.execPath,
    resourcesPath: process.resourcesPath,
    cwd: process.cwd(),
    userData: (() => {
      try {
        return app.getPath('userData');
      } catch {
        return null;
      }
    })(),
    logsDir: logsPath,
    KIOSK_HOST,
    kioskPortRuntime,
    backendPorts: { ...backendPorts },
    standaloneDir,
    serverEntry,
    backendJarsDir: backendDir,
    embeddedJavaCandidate: jreJava,
    exists: {
      serverEntry: serverEntry ? safeExists(serverEntry) : false,
      standaloneDir: standaloneDir ? safeExists(standaloneDir) : false,
      backendJarsDir: backendDir ? safeExists(backendDir) : false,
      embeddedJavaExe: jreJava ? safeExists(jreJava) : false
    }
  };

  const version = (() => {
    try {
      return app.getVersion();
    } catch {
      return 'desconhecida';
    }
  })();

  const lines = [];
  lines.push('# LunaKiosk - Relatorio de Falha de Inicializacao');
  lines.push('');
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push(`Versao: ${version}`);
  lines.push(`Plataforma: ${process.platform} ${process.arch} (node ${process.versions?.node || '?'}, electron ${process.versions?.electron || '?'})`);
  lines.push('');
  lines.push('## Erro');
  lines.push('```');
  lines.push(String(details || '').trim());
  lines.push('```');
  lines.push('');
  lines.push('## Checks');
  lines.push('```json');
  lines.push(JSON.stringify(checks, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Env (redigido)');
  lines.push('```json');
  lines.push(JSON.stringify(collectRelevantEnvSnapshot(), null, 2));
  lines.push('```');
  lines.push('');

  for (const lf of logFiles) {
    const tail = tailTextFile(lf);
    if (!tail) continue;
    lines.push(`## Log tail: ${lf}`);
    lines.push('```');
    lines.push(tail.trim());
    lines.push('```');
    lines.push('');
  }

  try {
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
    logLine(`[report] salvo: ${reportPath}`);
  } catch (e) {
    logLine(`[report] falha ao salvar (${reportPath}): ${String(e?.message || e)}`);
  }

  return { reportPath };
}

process.on('unhandledRejection', (reason) => {
  const details = String(reason?.message || reason);
  bootstrapLog(`[unhandledRejection] ${details}`);
  logLine(`[unhandledRejection] ${details}`);
});

process.on('uncaughtException', (err) => {
  const details = String(err?.stack || err?.message || err);
  bootstrapLog(`[uncaughtException] ${details}`);
  logLine(`[uncaughtException] ${details}`);
});

process.on('exit', (code) => {
  bootstrapLog(`process exit code=${code}`);
});

function findUp(startDir, filename, maxDepth = 8) {
  let current = startDir;
  for (let i = 0; i < maxDepth; i += 1) {
    const candidate = path.join(current, filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (!parent || parent === current) break;
    current = parent;
  }
  return null;
}

function tryLoadEnvFile(envPath, label) {
  try {
    if (!envPath) return false;
    if (!fs.existsSync(envPath)) return false;

    const result = dotenv.config({ path: envPath });
    if (result.error) {
      logLine(`[env] falha ao carregar ${label} (${envPath}): ${String(result.error?.message || result.error)}`);
      return false;
    }
    loadedEnvFilePath = envPath;
    loadedEnvLabel = label;
    logLine(`[env] carregado (${label}): ${envPath}`);
    return true;
  } catch (e) {
    logLine(`[env] falha ao carregar ${label}: ${String(e?.message || e)}`);
    return false;
  }
}

function loadDotEnvIfPresent() {
  // Em dev: procura um .env subindo diretórios (raiz do repo costuma ter).
  // Em packaged: por padrão NÃO incluímos segredos no instalador.
  // Porém, suportamos um .env externo em locais previsíveis para facilitar setup em campo.
  try {
    // 1) Caminho explícito (mais prioritário)
    if (tryLoadEnvFile(process.env.KIOSK_ENV_FILE, 'KIOSK_ENV_FILE')) return;

    // 2) Ao lado do executável (instalado/portable)
    if (app.isPackaged) {
      try {
        const exeDir = path.dirname(process.execPath);
        if (tryLoadEnvFile(path.join(exeDir, '.env'), 'exeDir')) return;
      } catch {
        // ignore
      }

      // 3) userData (LOCALAPPDATA\\LunaKiosk\\userData) - gravável
      try {
        const userDataEnv = path.join(app.getPath('userData'), '.env');
        if (tryLoadEnvFile(userDataEnv, 'userData')) return;
      } catch {
        // ignore
      }
    }

    // 4) Fallback para dev: sobe diretórios a partir do cwd
    const envPath = findUp(process.cwd(), '.env');
    if (tryLoadEnvFile(envPath, 'findUp(cwd)')) return;
  } catch (e) {
    logLine(`[env] falha ao procurar/carregar .env: ${String(e?.message || e)}`);
  }
}

function validateAsaasConfigOrThrow() {
  // Por padrão, em builds empacotados, exigimos configuração Asaas para evitar “travamento” no PIX.
  // Pode ser desligado com KIOSK_REQUIRE_ASAAS=false.
  const requireAsaas =
    String(process.env.KIOSK_REQUIRE_ASAAS || (app.isPackaged ? 'true' : 'false')).toLowerCase() === 'true';
  if (!requireAsaas) return;

  // Determina o ambiente do Asaas.
  // - Se ASAAS_ENVIRONMENT estiver definido, respeita.
  // - Caso contrário, tenta inferir: se existir credencial PROD, assume production; senão sandbox.
  const rawEnv = String(process.env.ASAAS_ENVIRONMENT || '').trim();
  const inferredEnv =
    rawEnv.length > 0
      ? rawEnv
      : process.env.ASAAS_PROD_API_KEY || process.env.ASAAS_PROD_WALLET_ID
        ? 'production'
        : 'sandbox';

  const env = String(inferredEnv).trim().toLowerCase();

  const missing = [];
  if (env === 'production' || env === 'prod') {
    if (!process.env.ASAAS_PROD_API_KEY) missing.push('ASAAS_PROD_API_KEY');
    if (!process.env.ASAAS_PROD_WALLET_ID) missing.push('ASAAS_PROD_WALLET_ID');
  } else {
    if (!process.env.ASAAS_SANDBOX_API_KEY) missing.push('ASAAS_SANDBOX_API_KEY');
    if (!process.env.ASAAS_SANDBOX_WALLET_ID) missing.push('ASAAS_SANDBOX_WALLET_ID');
  }

  // Webhook secret não é estritamente necessário para criar/consultar pagamentos, mas costuma ser obrigatório em produção.
  if (!process.env.ASAAS_WEBHOOK_SECRET) {
    logLine('[asaas] AVISO: ASAAS_WEBHOOK_SECRET não definido (webhook pode falhar)');
  }

  if (missing.length) {
    const where = app.isPackaged
      ? `\n\nDica: coloque um arquivo .env em um destes locais:\n- ${path.join(path.dirname(process.execPath), '.env')}\n- ${path.join(app.getPath('userData'), '.env')}\n\nOu defina as variáveis de ambiente no Windows.`
      : '';

    throw new Error(
      `Configuração Asaas ausente (${env}).\nFaltando: ${missing.join(', ')}\n` +
        `Dica: defina ASAAS_ENVIRONMENT=production (ou sandbox) conforme seu ambiente.${where}`
    );
  }
}

function getStandaloneDir() {
  // Empacotado: extraResources -> process.resourcesPath/next-standalone
  // Dev: pasta local no repo
  return app.isPackaged
    ? path.join(process.resourcesPath, 'next-standalone')
    : path.join(__dirname, 'next-standalone');
}

function getBackendJarsDir() {
  // Empacotado: extraResources -> process.resourcesPath/backend-jars
  // Dev: pasta local do projeto electron (sincronizada por script)
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend-jars')
    : path.join(__dirname, 'backend-jars');
}

function findJarByRegex(dir, regex) {
  try {
    const files = fs.readdirSync(dir);
    const candidates = files
      .filter((f) => regex.test(f))
      .filter((f) => f.toLowerCase().endsWith('.jar'))
      .filter((f) => !f.toLowerCase().endsWith('.jar.original'))
      .map((f) => path.join(dir, f));

    if (!candidates.length) return null;

    // pega o mais novo
    candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return candidates[0];
  } catch {
    return null;
  }
}

function waitForHttpOk(url, timeoutMs = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        // Considera OK apenas 2xx/3xx. 4xx normalmente indica endpoint errado ou app ainda não pronto.
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout aguardando servidor: ${url}`));
          return;
        }
        setTimeout(tick, 300);
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Servidor nÃ£o respondeu: ${url}`));
          return;
        }
        setTimeout(tick, 300);
      });
    };

    tick();
  });
}

function joinUrl(baseUrl, pathname) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const pathPart = String(pathname || '').startsWith('/') ? String(pathname || '') : `/${pathname || ''}`;
  return `${base}${pathPart}`;
}

function isHttpReachable(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode));
    });
    req.setTimeout(timeoutMs, () => {
      try {
        req.destroy();
      } catch {
        // ignore
      }
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function isTcpPortOpen(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const done = (result) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));

    try {
      socket.connect(port, host);
    } catch {
      done(false);
    }
  });
}

async function pickKioskPort(preferredPort) {
  const maxOffset = 20;
  const preferred = Number.parseInt(String(preferredPort), 10);
  if (!Number.isFinite(preferred)) return KIOSK_PORT;

  const preferredHealth = `http://${KIOSK_HOST}:${preferred}/api/health`;
  // Se a porta preferida já está servindo a UI, reutilize.
  if (await isHttpReachable(preferredHealth, 800)) {
    return preferred;
  }

  // Senão, procura uma porta livre para subir nosso server embarcado.
  for (let i = 0; i <= maxOffset; i += 1) {
    const port = preferred + i;
    // Se já tem algo na porta, pule.
    if (await isTcpPortOpen(KIOSK_HOST, port, 250)) continue;
    return port;
  }

  // fallback
  return preferred;
}

function killProcessTree(proc, label) {
  if (!proc || typeof proc.pid !== 'number') return;

  const pid = proc.pid;

  if (process.platform === 'win32') {
    try {
      // /T mata a árvore, /F força.
      spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true });
      logLine(`[${label}] taskkill pid=${pid}`);
      return;
    } catch {
      // ignore
    }
  }

  try {
    proc.kill('SIGTERM');
    logLine(`[${label}] kill pid=${pid}`);
  } catch {
    // ignore
  }
}

async function startSpringBootJar({
  name,
  jarPath,
  port,
  healthUrl,
  env = {},
  args = []
}) {
  if (!jarPath || !fs.existsSync(jarPath)) {
    throw new Error(`[${name}] jar nao encontrado: ${jarPath}`);
  }

  if (await isHttpReachable(healthUrl)) {
    logLine(`[${name}] ja esta respondendo em ${healthUrl}`);
    return;
  }

  if (await isTcpPortOpen(LOCAL_HOST, port)) {
    throw new Error(`[${name}] porta ${LOCAL_HOST}:${port} em uso`);
  }

  const logPath = path.join(getLogsDir(), `${name}.log`);
  const springProfile = process.env.SPRING_PROFILES_ACTIVE || 'production';
  const javaPath = embeddedJavaPath || getEmbeddedJavaPath();
  const javaBinDir = path.dirname(javaPath);
  const javaHome = path.dirname(javaBinDir);

  logLine(`[${name}] logPath=${logPath}`);
  logLine(`[${name}] jarPath=${jarPath}`);
  logLine(`[${name}] javaPath=${javaPath}`);

  const child = spawn(
    javaPath,
    [
      '-jar',
      jarPath,
      `--server.port=${port}`,
      `--spring.profiles.active=${springProfile}`,
      ...args
    ],
    {
      cwd: path.dirname(jarPath),
      env: {
        ...process.env,
        ...env,
        JAVA_HOME: javaHome,
        PATH: `${javaBinDir}${path.delimiter}${process.env.PATH || ''}`
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  backendProcesses.set(name, child);

  const out = fs.createWriteStream(logPath, { flags: 'a' });
  child.stdout.on('data', (d) => out.write(d));
  child.stderr.on('data', (d) => out.write(d));
  child.on('exit', (code) => {
    try {
      out.end();
    } catch {
      // ignore
    }
    logLine(`[${name}] saiu com code=${code}`);
    backendProcesses.delete(name);
  });

  await waitForHttpOk(healthUrl, 90000);
}

async function startBackendSuiteIfNeeded() {
  // Permite desativar o boot do backend (útil quando está tudo rodando externamente)
  if (String(process.env.KIOSK_SKIP_BACKENDS || '').toLowerCase() === 'true') {
    logLine('[backend] KIOSK_SKIP_BACKENDS=true (não vou subir JARs)');
    return;
  }

  const jarsDir = getBackendJarsDir();
  const coreJar = findJarByRegex(jarsDir, /^lunacore-.*\.jar$/i);
  const totemJar = findJarByRegex(jarsDir, /^totem-api-.*\.jar$/i);
  const payJar = findJarByRegex(jarsDir, /^lunapay-.*\.jar$/i);
  if (!coreJar || !totemJar || !payJar) {
    throw new Error(`Backend JARs nao encontrados em: ${jarsDir}`);
  }

  const coreHealth = `http://${LOCAL_HOST}:${backendPorts.lunacore}/actuator/health`;
  const totemHealth = `http://${LOCAL_HOST}:${backendPorts.totemapi}/actuator/health`;
  const payHealth = `http://${LOCAL_HOST}:${backendPorts.lunapay}/actuator/health`;

  // Mapeia as vars de DB para cada serviço (mantém compatibilidade com docker-compose)
  const jwt = process.env.JWT_SECRET;
  if (!jwt) {
    logLine('[backend] AVISO: JWT_SECRET não está definido (pode quebrar autenticação)');
  }

  await startSpringBootJar({
    name: 'lunacore',
    jarPath: coreJar,
    port: backendPorts.lunacore,
    healthUrl: coreHealth,
    env: {
      JWT_SECRET: jwt,
      SPRING_DATASOURCE_URL: process.env.NEON_LUNACORE_URL || process.env.SPRING_DATASOURCE_URL,
      TOTEM_API_BASE_URL: `http://${LOCAL_HOST}:${backendPorts.totemapi}`
    }
  });

  await startSpringBootJar({
    name: 'totemapi',
    jarPath: totemJar,
    port: backendPorts.totemapi,
    healthUrl: totemHealth,
    env: {
      JWT_SECRET: jwt,
      SPRING_DATASOURCE_URL: process.env.NEON_TOTEMAPI_URL || process.env.SPRING_DATASOURCE_URL,
      LUNACORE_URL: `http://${LOCAL_HOST}:${backendPorts.lunacore}`
    }
  });

  await startSpringBootJar({
    name: 'lunapay',
    jarPath: payJar,
    port: backendPorts.lunapay,
    healthUrl: payHealth,
    env: {
      JWT_SECRET: jwt,
      SPRING_DATASOURCE_URL: process.env.NEON_LUNAPAY_URL || process.env.SPRING_DATASOURCE_URL,
      LUNACORE_URL: `http://${LOCAL_HOST}:${backendPorts.lunacore}`,
      ASAAS_SANDBOX_API_KEY: process.env.ASAAS_SANDBOX_API_KEY,
      ASAAS_SANDBOX_WALLET_ID: process.env.ASAAS_SANDBOX_WALLET_ID,
      ASAAS_PROD_API_KEY: process.env.ASAAS_PROD_API_KEY,
      ASAAS_PROD_WALLET_ID: process.env.ASAAS_PROD_WALLET_ID,
      ASAAS_ENVIRONMENT: process.env.ASAAS_ENVIRONMENT,
      ASAAS_WEBHOOK_SECRET: process.env.ASAAS_WEBHOOK_SECRET
    }
  });
}

async function startTotemUiStandaloneServer() {
  // Em restarts, tentamos primeiro reutilizar a porta atual (se já calculada)
  // para evitar que a janela fique apontando para uma porta antiga.
  const preferred = Number.isFinite(kioskPortRuntime) ? kioskPortRuntime : KIOSK_PORT;
  kioskPortRuntime = await pickKioskPort(preferred);

  const standaloneDir = getStandaloneDir();
  const serverEntry = path.join(standaloneDir, 'server.js');

  const logPath = path.join(getLogsDir(), 'totemui.log');
  logLine(`logPath=${logPath}`);
  logLine(`isPackaged=${app.isPackaged}`);
  logLine(`standaloneDir=${standaloneDir}`);
  logLine(`serverEntry=${serverEntry}`);

  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `TotemUI server.js não encontrado.\n` +
        `standaloneDir=${standaloneDir}\n` +
        `serverEntry=${serverEntry}\n` +
        `resourcesPath=${process.resourcesPath}`
    );
  }

  const env = {
    ...process.env,
    PORT: String(kioskPortRuntime),
    HOSTNAME: KIOSK_HOST,
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || `http://localhost:${backendPorts.lunacore}`
  };

  const healthUrl = `http://${KIOSK_HOST}:${kioskPortRuntime}/api/health`;

  if (await isHttpReachable(healthUrl)) {
    logLine(`[TotemUI] servidor já está respondendo em ${healthUrl} (não vou spawnar outro)`);
    return;
  }

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: standaloneDir,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Em campo, é essencial ter um log separado do TotemUI.
  const out = fs.createWriteStream(logPath, { flags: 'a' });
  const writeOut = (prefix, data) => {
    try {
      out.write(`${new Date().toISOString()} ${prefix} ${String(data).trimEnd()}\n`);
    } catch {
      // ignore
    }
  };

  serverProcess.stdout.on('data', (d) => {
    logLine(`[TotemUI:stdout] ${String(d).trimEnd()}`);
    writeOut('[stdout]', d);
  });
  serverProcess.stderr.on('data', (d) => {
    logLine(`[TotemUI:stderr] ${String(d).trimEnd()}`);
    writeOut('[stderr]', d);
  });
  serverProcess.on('exit', (code) => {
    logLine(`[TotemUI] saiu com code=${code}`);
    writeOut('[exit]', `code=${code}`);
    try {
      out.end();
    } catch {
      // ignore
    }
  });
  serverProcess.on('error', (err) => {
    const msg = String(err?.stack || err?.message || err);
    logLine(`[TotemUI] falha ao spawnar processo: ${msg}`);
    writeOut('[spawn-error]', msg);
  });

  await waitForHttpOk(healthUrl, 30000);
}

function getRendererUrl() {
  return `http://${KIOSK_HOST}:${kioskPortRuntime}${KIOSK_START_URL}`;
}

function createWindow(targetUrl) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } catch {
      // ignore
    }
    return;
  }

  const isDebug = Boolean(process.env.KIOSK_DEBUG);

  // Workaround de CORS no kiosk:
  // Em produção (empacotado), preferimos que o app “funcione” mesmo que os backends não tenham CORS perfeito
  // para a porta dinâmica do TotemUI embarcado.
  // Pode ser desligado com KIOSK_ENABLE_WEB_SECURITY=true.
  const enableWebSecurity =
    String(process.env.KIOSK_ENABLE_WEB_SECURITY || (app.isPackaged ? 'false' : 'true')).toLowerCase() === 'true';

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: !isDebug,
    kiosk: !isDebug,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: enableWebSecurity
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const windowRef = mainWindow;

  const getTargetUrl = () => targetUrl || getRendererUrl();

  const showErrorPage = async (title, details) => {
    try {
      if (!windowRef || windowRef.isDestroyed()) return;
      const safeTitle = String(title || 'Erro');
      const safeDetails = String(details || '');
      const retryHint = `Recarregando automaticamente em alguns segundos...`;
      await windowRef.loadURL(
        `data:text/html,` +
          encodeURIComponent(
            `<!doctype html><html><head><meta charset="utf-8" />` +
              `<meta name="viewport" content="width=device-width,initial-scale=1" />` +
              `<title>${safeTitle}</title>` +
              `<style>body{font-family:Segoe UI,Arial,sans-serif;background:#111;color:#eee;margin:0;padding:24px}pre{white-space:pre-wrap;background:#1b1b1b;padding:12px;border-radius:8px}button{padding:10px 14px;border-radius:8px;border:0;background:#2d6cdf;color:#fff;font-weight:600;cursor:pointer}</style>` +
              `</head><body>` +
              `<h2>${safeTitle}</h2>` +
              `<p>${retryHint}</p>` +
              `<p><button onclick="location.reload()">Recarregar agora</button></p>` +
              `<h3>Detalhes</h3><pre>${safeDetails}</pre>` +
              `</body></html>`
          )
      );
    } catch {
      // ignore
    }
  };

  // Diagnóstico para “tela branca”: falha de navegação, crash do renderer, etc.
  try {
    windowRef.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      const msg = `did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`;
      logLine(`[webContents] ${msg}`);
      showErrorPage('Falha ao carregar a tela', msg);
      setTimeout(() => {
        try {
          if (!windowRef || windowRef.isDestroyed()) return;
          // Tentativa de auto-recuperação: se o servidor embutido caiu, tenta subir de novo.
          Promise.resolve(startTotemUiStandaloneServer())
            .catch((e) => {
              const details = String(e?.stack || e?.message || e);
              logLine(`[TotemUI] restart falhou: ${details}`);
            })
            .finally(() => {
              try {
                if (!windowRef || windowRef.isDestroyed()) return;
                doLoad();
              } catch {
                // ignore
              }
            });
        } catch {
          // ignore
        }
      }, 3000);
    });

    windowRef.webContents.on('render-process-gone', (_event, details) => {
      const msg = `render-process-gone reason=${details?.reason} exitCode=${details?.exitCode}`;
      logLine(`[webContents] ${msg}`);
      showErrorPage('A tela travou (renderer caiu)', msg);
      setTimeout(() => {
        try {
          if (!windowRef || windowRef.isDestroyed()) return;
          windowRef.reload();
        } catch {
          // ignore
        }
      }, 3000);
    });

    windowRef.webContents.on('unresponsive', () => {
      logLine('[webContents] unresponsive');
    });

    windowRef.webContents.on('responsive', () => {
      logLine('[webContents] responsive');
    });

    windowRef.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      logLine(`[renderer:console] level=${level} ${sourceId}:${line} ${message}`);
    });
  } catch {
    // ignore
  }

  // Em modo kiosk/instalado, queremos sempre começar “limpo” (sem abrir CRM automaticamente por sessão antiga).
  // Default: true quando empacotado; em dev, default false.
  const shouldClearSession =
    String(process.env.KIOSK_CLEAR_SESSION_ON_START || (app.isPackaged ? 'true' : 'false')).toLowerCase() === 'true';

  const doLoad = () => {
    if (!windowRef || windowRef.isDestroyed()) return;
    windowRef
      .loadURL(getTargetUrl())
      .catch((e) => {
        try {
          if (!windowRef || windowRef.isDestroyed()) return;
          const msg = String(e?.stack || e?.message || e);
          logLine(`[window] loadURL falhou: ${msg}`);
          return showErrorPage('Erro ao abrir TotemUI', msg);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // ignore
      });
  };

  if (shouldClearSession) {
    try {
      const ses = windowRef.webContents.session;
      Promise.resolve(
        ses.clearStorageData({
          storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
        })
      )
        .catch(() => {
          // ignore
        })
        .finally(() => doLoad());
      return;
    } catch {
      // ignore
    }
  }

  doLoad();

  if (isDebug) {
    try {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } catch {
      // ignore
    }
  }
}

// Garante que sÃ³ exista UMA instÃ¢ncia do app.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } catch {
        // ignore
      }
      return;
    }

    // Em dev, abre o renderer externo imediatamente.
    if (ELECTRON_RENDERER_URL) {
      createWindow(joinUrl(ELECTRON_RENDERER_URL, KIOSK_START_URL));
      return;
    }

    // Em produção, espere o bootstrap terminar (backends + TotemUI) para não abrir em uma URL “vazia”.
    if (startupPromise && !startupDone) {
      Promise.resolve(startupPromise)
        .catch(() => {
          // ignore (o fluxo de erro já mostra tela com detalhes)
        })
        .finally(() => {
          try {
            createWindow();
          } catch {
            // ignore
          }
        });
      return;
    }

    // Caso raro: sem janela e sem startup em andamento.
    createWindow();
  });
}

app.whenReady().then(async () => {
  bootstrapLog('app.whenReady');
  logLine('[startup] whenReady');
  loadDotEnvIfPresent();

  startupPromise = (async () => {
    try {
    // Em dev, se ELECTRON_RENDERER_URL estiver definido, abre o renderer externo (ex: Expo web)
    // e evita spawnar o servidor embarcado (que pode dar conflito de porta e travar com multiplas instancias).
    if (ELECTRON_RENDERER_URL) {
      createWindow(joinUrl(ELECTRON_RENDERER_URL, KIOSK_START_URL));
      return;
    }

    const skipBackends = String(process.env.KIOSK_SKIP_BACKENDS || '').toLowerCase() === 'true';
    validateEmbeddedJava21OrThrow();
    bootstrapLog('java validated (embedded)');

    if (!skipBackends) {
      const resolved = await resolveBackendPortsAuto();
      updateBackendPorts(resolved.ports);
      process.env.NEXT_PUBLIC_API_URL = `http://localhost:${backendPorts.lunacore}`;
      if (resolved.usedFallback) {
        logLine(`[ports] usando fallback: ${resolved.ports.join(', ')}`);
      }
      bootstrapLog(`ports resolved ${resolved.ports.join(', ')} fallback=${resolved.usedFallback}`);
    } else {
      updateBackendPorts([LUNACORE_PORT, TOTEMAPI_PORT, LUNAPAY_PORT]);
      process.env.NEXT_PUBLIC_API_URL = `http://localhost:${backendPorts.lunacore}`;
      bootstrapLog(`ports resolved skipBackends=true ports=${LUNACORE_PORT},${TOTEMAPI_PORT},${LUNAPAY_PORT}`);
    }

    installCorsWorkaround();

    // Falha rapido se faltar credencial Asaas (evita travar o fluxo de pagamento no kiosk).
    validateAsaasConfigOrThrow();

    if (!skipBackends) {
      bootstrapLog('starting backends');
      await startBackendSuiteIfNeeded();
      bootstrapLog('backends up');
    }

    await startTotemUiStandaloneServer();
    bootstrapLog('TotemUI up');
    createWindow();
    bootstrapLog('window created');
    startupDone = true;
    return;
    } catch (e) {
    const details = String(e?.stack || e?.message || e);
    bootstrapLog(`[startup] falha: ${details}`);
    logLine(`[startup] falha: ${details}`);
    for (const [name, proc] of backendProcesses.entries()) {
      killProcessTree(proc, name);
    }
    backendProcesses.clear();
    await showStartupError(details);

    const win = new BrowserWindow({
      width: 900,
      height: 600,
      autoHideMenuBar: true
    });
    const hint = `Dica: crie um arquivo .env com as variaveis necessarias.
Locais suportados (em ordem):
- KIOSK_ENV_FILE=C:\\caminho\\para\\.env (explicito)
- ${path.join(path.dirname(process.execPath), '.env')}
- ${path.join(app.getPath('userData'), '.env')}

Para testar SEM pagamentos (nao recomendado), voce pode definir:
- KIOSK_REQUIRE_ASAAS=false
`;

    win.loadURL(
      `data:text/html,` +
        encodeURIComponent(
          `<!doctype html><html><head><meta charset="utf-8" />` +
            `<meta name="viewport" content="width=device-width,initial-scale=1" />` +
            `<title>Falha ao iniciar TotemUI embarcado</title>` +
            `<style>body{font-family:Segoe UI,Arial,sans-serif;background:#111;color:#eee;margin:0;padding:24px}pre{white-space:pre-wrap;background:#1b1b1b;padding:12px;border-radius:8px}</style>` +
            `</head><body>` +
            `<h2>Falha ao iniciar TotemUI embarcado</h2>` +
            `<h3>Mensagem</h3><pre>${details}</pre>` +
            `<h3>Como resolver</h3><pre>${hint}</pre>` +
            `</body></html>`
        )
    );
    throw e;
    }
  })();

  // Evita unhandledRejection e mantém o promise “consumido”.
  startupPromise.catch(() => {
    // ignore
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  bootstrapLog('window-all-closed');
  if (serverProcess) {
    try {
      killProcessTree(serverProcess, 'totemui');
    } catch {
      // ignore
    }
  }

  for (const [name, proc] of backendProcesses.entries()) {
    killProcessTree(proc, name);
  }
  backendProcesses.clear();

  if (logFileStream) {
    try {
      logFileStream.end();
    } catch {
      // ignore
    }
  }
  if (process.platform !== 'darwin') app.quit();
});










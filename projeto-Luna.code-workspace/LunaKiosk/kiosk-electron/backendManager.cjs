const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, spawnSync } = require('child_process');
const { app } = require('electron');

const backendProcesses = new Map();

function resolveJavaPath() {
  const override = process.env.KIOSK_JAVA_PATH;
  if (override && fs.existsSync(override)) return override;

  const baseDir = app && app.isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');
  const javaPath = path.join(baseDir, 'jre', 'bin', 'java.exe');

  if (fs.existsSync(javaPath)) return javaPath;

  if (app && app.isPackaged) {
    throw new Error(`Bundled JRE not found at: ${javaPath}`);
  }

  return 'java';
}

function checkPort(port, host = '127.0.0.1', timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const done = (inUse) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(inUse);
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

async function findFreePorts(ports, fallbackBase = 18080, host = '127.0.0.1') {
  const basePorts = ports.map((p) => Number.parseInt(String(p), 10)).filter(Number.isFinite);
  if (!basePorts.length) {
    return {
      ports: [],
      inUse: [],
      fallbackPorts: [],
      fallbackInUse: [],
      usedFallback: false
    };
  }

  const inUseFlags = await Promise.all(basePorts.map((p) => checkPort(p, host)));
  const inUse = basePorts.filter((p, i) => inUseFlags[i]);
  if (!inUse.length) {
    return { ports: basePorts, inUse, fallbackPorts: [], fallbackInUse: [], usedFallback: false };
  }

  const base = basePorts[0];
  const fallbackPorts = basePorts.map((p) => fallbackBase + (p - base));
  const fallbackFlags = await Promise.all(fallbackPorts.map((p) => checkPort(p, host)));
  const fallbackInUse = fallbackPorts.filter((p, i) => fallbackFlags[i]);

  return {
    ports: fallbackPorts,
    inUse,
    fallbackPorts,
    fallbackInUse,
    usedFallback: fallbackInUse.length === 0
  };
}

function spawnBackend({ name, jarPath, port, extraEnv = {}, logPath, args = [], javaPath }) {
  if (!jarPath || !fs.existsSync(jarPath)) {
    throw new Error(`[${name}] jar not found: ${jarPath}`);
  }
  if (!logPath) {
    throw new Error(`[${name}] logPath is required`);
  }

  const resolvedJava = javaPath || resolveJavaPath();
  const javaBinDir = path.dirname(resolvedJava);
  const javaHome = path.dirname(javaBinDir);

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const out = fs.createWriteStream(logPath, { flags: 'a' });

  const child = spawn(
    resolvedJava,
    [
      '-jar',
      jarPath,
      `--server.port=${port}`,
      ...args
    ],
    {
      cwd: path.dirname(jarPath),
      env: {
        ...process.env,
        ...extraEnv,
        JAVA_HOME: javaHome,
        PATH: `${javaBinDir}${path.delimiter}${process.env.PATH || ''}`
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  backendProcesses.set(name, child);

  child.stdout.on('data', (d) => out.write(d));
  child.stderr.on('data', (d) => out.write(d));
  child.on('exit', () => {
    try {
      out.end();
    } catch {
      // ignore
    }
    backendProcesses.delete(name);
  });

  return child;
}

function waitForHealth(url, timeoutMs = 90000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for health: ${url}`));
          return;
        }
        setTimeout(tick, 300);
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Health check failed: ${url}`));
          return;
        }
        setTimeout(tick, 300);
      });
    };

    tick();
  });
}

function killProcessTree(proc, label) {
  if (!proc || proc.killed || !proc.pid) return;

  try {
    proc.kill('SIGTERM');
  } catch {
    // ignore
  }

  const pid = proc.pid;
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } catch {
      // ignore
    }
  }
}

async function stopAllBackends() {
  for (const [name, proc] of backendProcesses.entries()) {
    killProcessTree(proc, name);
  }
  backendProcesses.clear();
}

module.exports = {
  resolveJavaPath,
  checkPort,
  findFreePorts,
  spawnBackend,
  waitForHealth,
  stopAllBackends
};

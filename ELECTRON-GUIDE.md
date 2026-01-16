# 🖥️ Electron Desktop App - Sistema Luna

Guia para transformar o Sistema Luna em aplicação desktop instalável.

## 📋 Visão Geral

O objetivo é empacotar todo o stack (LunaCore, TotemAPI, LunaPay, TotemUI) em uma aplicação Electron que:

- ✅ Instala e roda localmente sem Docker
- ✅ Inclui backend Java embutido
- ✅ Interface desktop nativa (TotemUI)
- ✅ Funciona offline com banco SQLite local
- ✅ Sincroniza com Neon quando online
- ✅ Auto-update capabilities

## 🏗️ Arquitetura Proposta

```
electron-app/
├── main.js              # Electron main process
├── preload.js           # Bridge entre renderer e main
├── renderer/            # TotemUI (React)
├── backend/
│   ├── lunacore.jar     # Spring Boot standalone
│   ├── totemapi.jar
│   └── lunapay.jar
├── jre/                 # Embedded JRE 21
├── database/
│   └── luna.db          # SQLite local (offline mode)
└── package.json
```

## 🚀 Fase 1: Preparar JARs Standalone

### 1.1. Modificar pom.xml para Executable JAR

Cada projeto Spring Boot precisa gerar JAR executável:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <executable>true</executable>
                <layout>JAR</layout>
            </configuration>
        </plugin>
    </plugins>
</build>
```

### 1.2. Build JARs

```bash
# LunaCore
cd projeto-Luna.code-workspace/LunaCore
mvn clean package -DskipTests

# TotemAPI
cd ../LunaTotem/LunaTotem
mvn clean package -DskipTests

# LunaPay
cd ../LunaPay
mvn clean package -DskipTests
```

JARs gerados em:
- `LunaCore/target/lunacore-1.0.0.jar`
- `LunaTotem/target/totemapi-1.0.0.jar`
- `LunaPay/target/lunapay-1.0.0.jar`

## 🔧 Fase 2: Criar Estrutura Electron

### 2.1. Inicializar Projeto Electron

```bash
mkdir luna-desktop
cd luna-desktop

npm init -y
npm install --save electron electron-builder
npm install --save-dev electron-packager
```

### 2.2. Criar main.js

```javascript
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

let mainWindow;
let backendProcesses = [];

// Portas
const PORTS = {
  lunacore: 8080,
  totemapi: 8081,
  lunapay: 8082,
  totemui: 3000
};

// Verifica se porta está livre
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Inicia backend Java
async function startBackend(name, jar, port) {
  const isFree = await isPortFree(port);
  if (!isFree) {
    console.log(`${name} já está rodando na porta ${port}`);
    return null;
  }

  const javaPath = path.join(__dirname, 'jre', 'bin', 'java.exe');
  const jarPath = path.join(__dirname, 'backend', jar);

  const process = spawn(javaPath, [
    '-jar',
    '-Xms256m',
    '-Xmx512m',
    jarPath
  ], {
    cwd: path.join(__dirname, 'backend'),
    env: {
      ...process.env,
      SERVER_PORT: port,
      SPRING_PROFILES_ACTIVE: 'desktop'
    }
  });

  process.stdout.on('data', (data) => {
    console.log(`[${name}] ${data}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`[${name}] ${data}`);
  });

  backendProcesses.push(process);
  return process;
}

// Cria janela principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png')
  });

  // Aguarda backends iniciarem (30s timeout)
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 30000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.on('ready', async () => {
  console.log('Starting Luna Desktop...');

  // Iniciar backends
  await startBackend('LunaCore', 'lunacore-1.0.0.jar', PORTS.lunacore);
  await startBackend('TotemAPI', 'totemapi-1.0.0.jar', PORTS.totemapi);
  await startBackend('LunaPay', 'lunapay-1.0.0.jar', PORTS.lunapay);
  
  // TotemUI (pode usar servidor Vite embutido ou servir estático)
  // Por enquanto assumimos que TotemUI está em servidor separado

  createWindow();
});

app.on('window-all-closed', () => {
  // Matar backends
  backendProcesses.forEach(p => p.kill());
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```

### 2.3. Criar preload.js

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkHealth: () => ipcRenderer.invoke('check-health'),
  getLogs: () => ipcRenderer.invoke('get-logs')
});
```

### 2.4. package.json

```json
{
  "name": "luna-desktop",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "build": {
    "appId": "com.luna.desktop",
    "productName": "Luna Totem",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer/**/*",
      "backend/**/*",
      "jre/**/*",
      "icon.png"
    ],
    "extraResources": [
      {
        "from": "backend/",
        "to": "backend/",
        "filter": ["*.jar"]
      },
      {
        "from": "jre/",
        "to": "jre/"
      }
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

## 📦 Fase 3: Empacotar JRE

### 3.1. Baixar JRE 21

```bash
# Windows
wget https://download.java.net/java/GA/jdk21/fd2272bbf8e04c3dbaee13770090416c/35/GPL/openjdk-21_windows-x64_bin.zip

# Extrair apenas JRE
jlink --add-modules java.base,java.sql,java.naming,java.desktop,java.management,java.security.jgss,java.instrument `
      --output jre `
      --strip-debug `
      --no-man-pages `
      --no-header-files `
      --compress=2
```

Isso cria um JRE mínimo (~50MB) com apenas os módulos necessários.

## 🗄️ Fase 4: SQLite Local (Modo Offline)

### 4.1. Adicionar SQLite Dialect

Em cada projeto Spring Boot:

```xml
<dependency>
    <groupId>org.xerial</groupId>
    <artifactId>sqlite-jdbc</artifactId>
    <version>3.44.1.0</version>
</dependency>
<dependency>
    <groupId>org.hibernate.orm</groupId>
    <artifactId>hibernate-community-dialects</artifactId>
</dependency>
```

### 4.2. Profile "desktop" em application.yml

```yaml
spring:
  profiles: desktop
  datasource:
    url: jdbc:sqlite:database/luna.db
    driver-class-name: org.sqlite.JDBC
  jpa:
    database-platform: org.hibernate.community.dialect.SQLiteDialect
    hibernate:
      ddl-auto: update
```

### 4.3. Sincronização Bidirecional

Criar serviço de sync:

```java
@Service
public class SyncService {
    
    @Scheduled(fixedDelay = 300000) // 5 min
    public void syncWithCloud() {
        if (isOnline()) {
            // Pull from Neon
            // Push local changes to Neon
        }
    }
    
    private boolean isOnline() {
        try {
            URL url = new URL("https://appealing-appreciation-production.up.railway.app/actuator/health");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            return conn.getResponseCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }
}
```

## 🔨 Fase 5: Build e Distribuição

### 5.1. Build Completo

```bash
# 1. Build backends
cd projeto-Luna.code-workspace/LunaCore && mvn clean package -DskipTests
cd ../LunaTotem/LunaTotem && mvn clean package -DskipTests
cd ../LunaPay && mvn clean package -DskipTests

# 2. Copiar JARs
mkdir -p luna-desktop/backend
cp LunaCore/target/*.jar luna-desktop/backend/
cp LunaTotem/target/*.jar luna-desktop/backend/
cp LunaPay/target/*.jar luna-desktop/backend/

# 3. Build Electron
cd luna-desktop
npm run build:win
```

### 5.2. Resultado

```
dist/
├── Luna Totem Setup 1.0.0.exe    # Instalador NSIS (~200MB)
└── Luna Totem 1.0.0.exe          # Portable (~200MB)
```

## 🎯 Próximos Passos (Roadmap)

### Imediato (Fase 1)
- [ ] Validar Docker build completo
- [ ] Testar todos os serviços em containers
- [ ] Documentar workflow de desenvolvimento

### Curto Prazo (Fase 2)
- [ ] Preparar JARs standalone
- [ ] Criar estrutura básica Electron
- [ ] Implementar launch de backends

### Médio Prazo (Fase 3)
- [ ] Integrar SQLite local
- [ ] Sistema de sincronização
- [ ] Auto-update

### Longo Prazo (Fase 4)
- [ ] Instalador MSI profissional
- [ ] Code signing
- [ ] Store distribution (Microsoft Store)

## 📊 Comparação: Docker vs Electron

| Aspecto | Docker | Electron |
|---------|--------|----------|
| **Tamanho** | ~500MB (imagens) | ~200MB (instalador) |
| **Instalação** | Requer Docker Desktop | Instalador nativo |
| **Performance** | Excelente | Boa |
| **Offline** | Não | Sim (SQLite) |
| **Updates** | Rebuild images | Auto-update |
| **Target** | Developers | End users |
| **Complexidade** | Média | Alta |

## 🔍 Considerações

### Vantagens Electron
- ✅ Instalação nativa (duplo-clique)
- ✅ Funciona offline
- ✅ Não requer Docker
- ✅ Ícone na área de trabalho
- ✅ Auto-update embutido

### Desafios Electron
- ⚠️ Tamanho do pacote (~200MB)
- ⚠️ Complexidade de manter 2 BDs (SQLite + Neon)
- ⚠️ Sincronização pode ter conflitos
- ⚠️ Debugging mais difícil
- ⚠️ JRE embutido (licença?)

## 📚 Recursos

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [Spring Boot Executable JAR](https://docs.spring.io/spring-boot/docs/current/reference/html/executable-jar.html)
- [SQLite JDBC](https://github.com/xerial/sqlite-jdbc)

---

**🎯 Recomendação**: Primeiro validar Docker (Fase 1), depois partir para Electron (Fase 2).

Docker é mais rápido de implementar e testar. Electron pode vir depois como "produto final" para clientes.

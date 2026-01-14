# Windows Services (Always-on Backend)

Este pacote instala **LunaCore** e **TotemAPI** como **serviços do Windows**.

- Iniciam automaticamente com o Windows (Startup Type: Automatic)
- Reiniciam automaticamente se caírem
- Mantêm logs em disco

## Pré-requisitos

- Windows 10/11
- **Java 21** instalado e disponível no `PATH` (`java -version`)
- Permissão de **Administrador** (para instalar/remover serviços)

## Portas padrão

- LunaCore: `18080`
- TotemAPI: `18081`

> Ajuste em `deploy/windows-services/config.ps1`.

## Instalar

No PowerShell **como Administrador**:

```powershell
cd deploy\windows-services
.\install-services.ps1
```

### Testar antes de empacotar (sem instalar serviço)

Gera a pasta `_runtime` e os arquivos do WinSW (XML/EXE), mas **não** instala/inicia serviços:

```powershell
cd deploy\windows-services
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-services.ps1 -GenerateOnly
```

Se você já instalou os serviços e quer validar rapidamente os health checks:

```powershell
cd deploy\windows-services
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-services.ps1 -VerifyHttp
```

## Ver status

```powershell
cd deploy\windows-services
.\status-services.ps1
```

## Desinstalar

```powershell
cd deploy\windows-services
.\uninstall-services.ps1
```

## Onde ficam os logs

- `deploy/windows-services/_runtime/LunaCoreService/logs/`
- `deploy/windows-services/_runtime/TotemAPIService/logs/`

## Observações importantes

- O TotemAPI usa `PORT` (compatível com Render). O script define `PORT=18081`.
- As aplicações já possuem defaults para datasource (Neon) e alguns segredos; para produção **troque os segredos** no `config.ps1`.

$ErrorActionPreference = 'Stop'

# PowerShell 7+ can treat native stderr output as errors (NativeCommandError)
# when $ErrorActionPreference is Stop. Next.js writes warnings to stderr,
# so we disable this behavior and rely on process exit codes instead.
try { $PSNativeCommandUseErrorActionPreference = $false } catch { }

function New-BuildTag {
  return (Get-Date -Format 'yyyyMMdd-HHmmss')
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..')
Set-Location $root

$tag = New-BuildTag
$env:BUILD_TAG = $tag
$env:PATCH_ID = $tag

$log = Join-Path $root "dist\build-portable-$tag.log"
"[build-portable-only] BUILD_TAG=$tag" | Out-File -FilePath $log -Encoding utf8

function Run-CmdLogged($name, $cmdLine) {
  "\n[$name] $cmdLine" | Out-File -FilePath $log -Append -Encoding utf8
  # Redirect stderr to stdout INSIDE cmd.exe so PowerShell doesn't treat it as NativeCommandError.
  & cmd.exe /d /s /c "$cmdLine 2>&1" | Out-File -FilePath $log -Append -Encoding utf8
  if ($LASTEXITCODE -ne 0) {
    throw "$name failed (exit=$LASTEXITCODE). Veja: $log"
  }
}

Run-CmdLogged 'sync:jre' 'npm run sync:jre'
Run-CmdLogged 'sync:backend' 'npm run sync:backend'
Run-CmdLogged 'sync:totemui' 'npm run sync:totemui'
Run-CmdLogged 'verify:artifacts' 'npm run verify:artifacts'

Run-CmdLogged 'electron-builder portable' 'npx electron-builder --win portable --x64'

Write-Host "OK: portable gerado. Veja logs: $log" -ForegroundColor Green

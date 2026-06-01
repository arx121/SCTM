# SoundCloud Random Music Windows launcher
$ErrorActionPreference = "Stop"

function Pause-And-Exit([int]$Code = 0) {
  if ($Code -eq 0) {
    exit 0
  }

  Write-Host ""
  Read-Host "Press Enter to close this window"
  exit $Code
}

try {
  [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  chcp 65001 | Out-Null
} catch {}

function Add-Path-IfExists($PathToAdd) {
  if ($PathToAdd -and (Test-Path -LiteralPath $PathToAdd)) {
    if (($env:Path -split ';') -notcontains $PathToAdd) {
      $env:Path = "$PathToAdd;$env:Path"
    }
  }
}

function Refresh-Path {
  try {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
  } catch {}
  Add-Path-IfExists "$env:LOCALAPPDATA\Microsoft\WinGet\Links"
  Add-Path-IfExists "C:\Program Files\MPV Player"
  Add-Path-IfExists "C:\Program Files (x86)\MPV Player"
}

function Has-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-With-Winget($Id, $Name) {
  if (-not (Has-Command "winget")) {
    Write-Host "winget не найден. Установи $Name вручную." -ForegroundColor Red
    return $false
  }
  Write-Host "Устанавливаю $Name через winget..." -ForegroundColor Yellow
  & winget install --id $Id -e --source winget --accept-package-agreements --accept-source-agreements
  Refresh-Path
  return ($LASTEXITCODE -eq 0)
}

try {
  Set-Location -LiteralPath $PSScriptRoot
  Refresh-Path
  try { Clear-Host } catch {}
  try { $Host.UI.RawUI.WindowTitle = "SoundCloud Random Music" } catch {}
  try {
    if ($Host.Name -like "*ConsoleHost*") {
      $size = $Host.UI.RawUI.WindowSize
      if ($size.Width -lt 120) { $size.Width = 120 }
      if ($size.Height -lt 34) { $size.Height = 34 }
      $Host.UI.RawUI.WindowSize = $size
    }
  } catch {}

  Write-Host "SoundCloud Random Music" -ForegroundColor Cyan
  Write-Host "=======================" -ForegroundColor DarkGray
  Write-Host "Windows PowerShell mode" -ForegroundColor DarkGray
  if ($env:SRM_DATA_DIR) { Write-Host "Portable data: $env:SRM_DATA_DIR" -ForegroundColor DarkGray }
  Write-Host ""

  $env:npm_config_registry = "https://registry.npmjs.org/"
  $env:npm_config_audit = "false"
  $env:npm_config_fund = "false"

  if (-not (Has-Command "node")) {
    Write-Host "Node.js не найден." -ForegroundColor Yellow
    $answer = Read-Host "Поставить Node.js LTS через winget? y/n"
    if ($answer -match "^(y|yes|д|да)$") { Install-With-Winget "OpenJS.NodeJS.LTS" "Node.js LTS" | Out-Null }
    Refresh-Path
  }
  if (-not (Has-Command "node")) {
    Write-Host "Ошибка: node всё ещё не найден." -ForegroundColor Red
    Write-Host "Команда для ручной установки: winget install --id OpenJS.NodeJS.LTS -e --source winget" -ForegroundColor Yellow
    Pause-And-Exit 1
  }
  if (-not (Has-Command "npm")) {
    Write-Host "Ошибка: npm не найден. Он должен ставиться вместе с Node.js." -ForegroundColor Red
    Pause-And-Exit 1
  }

  if (-not (Has-Command "mpv")) {
    Write-Host "mpv не найден. Без него музыка не запустится." -ForegroundColor Yellow
    $answer = Read-Host "Поставить mpv сейчас? y/n"
    if ($answer -match "^(y|yes|д|да)$") { Install-With-Winget "shinchiro.mpv" "mpv" | Out-Null }
    Refresh-Path
  }
  if (-not (Has-Command "yt-dlp")) {
    Write-Host "yt-dlp не найден. Он нужен для стабильного получения треков." -ForegroundColor Yellow
    $answer = Read-Host "Поставить yt-dlp сейчас? y/n"
    if ($answer -match "^(y|yes|д|да)$") { Install-With-Winget "yt-dlp.yt-dlp" "yt-dlp" | Out-Null }
    Refresh-Path
  }

  if (-not (Test-Path -LiteralPath "node_modules")) {
    Write-Host "Первый запуск: устанавливаю npm-зависимости..." -ForegroundColor Yellow
    & npm install --registry=https://registry.npmjs.org/ --no-audit --fund=false
    if ($LASTEXITCODE -ne 0) {
      Write-Host "npm install завершился с ошибкой." -ForegroundColor Red
      Pause-And-Exit $LASTEXITCODE
    }
    Write-Host ""
  }

  if (-not (Has-Command "srm")) {
    Write-Host "Подключаю команду srm..." -ForegroundColor Yellow
    & npm link
    Refresh-Path
    Write-Host ""
  }

  Write-Host "Version:" -ForegroundColor DarkGray
  & node .\src\index.mjs --version
  Write-Host ""
  Write-Host "Starting..." -ForegroundColor Green
  Write-Host ""
  & node .\src\index.mjs
  $exitCode = $LASTEXITCODE
  if ($null -eq $exitCode) { $exitCode = 0 }
  Pause-And-Exit $exitCode
} catch {
  Write-Host ""
  Write-Host "Ошибка запуска:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Pause-And-Exit 1
}

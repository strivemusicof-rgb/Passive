# Upload LANDRUSH to TestFlight from Windows (same steps App Shipper runs).
# Run:  powershell -ExecutionPolicy Bypass -File ship-testflight.ps1
$ErrorActionPreference = 'Stop'

$Repo   = 'https://github.com/strivemusicof-rgb/passive.git'
$Branch = 'claude/landrush-foundation'
$Folder = Join-Path $HOME 'landrush'

# 1. Tools
foreach ($tool in 'git', 'node') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed." }
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { npm install -g pnpm@10 }

# 2. Latest code
if (Test-Path (Join-Path $Folder '.git')) {
  git -C $Folder fetch origin $Branch
  git -C $Folder checkout $Branch
  git -C $Folder pull --ff-only origin $Branch
} else {
  git clone --branch $Branch $Repo $Folder
}
if ($LASTEXITCODE -ne 0) { throw 'Getting the code failed.' }

# 3. Packages
Set-Location $Folder
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed.' }

# 4. App Store Connect key (never in git)
$App = Join-Path $Folder 'app'
if (-not (Test-Path (Join-Path $App 'keys\AuthKey.p8'))) {
  throw "Put your App Store Connect key at $App\keys\AuthKey.p8 and run again."
}

# 5. Build in the cloud and send to TestFlight
Set-Location $App
$env:EXPO_NO_CAPABILITY_SYNC = '1'
npx --yes eas-cli@latest build --platform ios --profile production --auto-submit
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Read the lines above.' }
Write-Host 'Done. The build reaches TestFlight in about 10-30 minutes.' -ForegroundColor Green

param([Parameter(Mandatory = $true)][string]$NodeExecutable)
$ErrorActionPreference = 'Stop'
$appFolder = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$savedPathFile = Join-Path $appFolder '.admin-publish-dir'

function Test-PublishFolder([string]$folder) {
  if ([string]::IsNullOrWhiteSpace($folder) -or -not (Test-Path -LiteralPath $folder -PathType Container)) { return $false }
  if (-not (Test-Path -LiteralPath (Join-Path $folder 'index.html') -PathType Leaf)) { return $false }
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return $false }
  try {
    $null = & git -C $folder rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    $null = & git -C $folder symbolic-ref --quiet --short HEAD 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    $remote = & git -C $folder config --get remote.origin.url 2>$null
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch '(?i)(^|://|@)github\.com[:/].+') { return $false }
    $pushRemotes = @(& git -C $folder config --get-all remote.origin.pushurl 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $pushRemotes.Count) { $pushRemotes = @($remote) }
    foreach ($pushRemote in $pushRemotes) { if ($pushRemote -notmatch '(?i)(^|://|@)github\.com[:/].+') { return $false } }
    return $true
  } catch { return $false }
}

$publishFolder = ''
if (Test-Path -LiteralPath $savedPathFile) {
  $candidate = (Get-Content -LiteralPath $savedPathFile -Raw).Trim()
  if (Test-PublishFolder $candidate) { $publishFolder = (Resolve-Path -LiteralPath $candidate).Path }
}

if (-not $publishFolder) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    'Universal changes must go to the folder that GitHub Pages publishes. Choose the folder in your GitHub checkout that contains the live index.html and is linked to your GitHub repository. GitHub Pages will then serve the shared data from that same folder.',
    'Choose the live Undertow site folder', 'OK', 'Information'
  ) | Out-Null
  $picker = New-Object System.Windows.Forms.FolderBrowserDialog
  $picker.Description = 'Choose the GitHub checkout publishing folder containing the live index.html. For a /docs site, choose the docs folder.'
  $picker.ShowNewFolderButton = $false
  if (Test-Path -LiteralPath (Join-Path $appFolder 'index.html')) { $picker.SelectedPath = $appFolder }
  if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $candidate = (Resolve-Path -LiteralPath $picker.SelectedPath).Path
    if (Test-PublishFolder $candidate) {
      $publishFolder = $candidate
      Set-Content -LiteralPath $savedPathFile -Value $publishFolder -Encoding UTF8
    } else {
      [System.Windows.Forms.MessageBox]::Show(
        'That folder must contain index.html and be inside a GitHub checkout with an origin remote. The editor will still open, but Universal publishing will stay disabled until you choose the correct folder.',
        'Folder is not connected to GitHub', 'OK', 'Warning'
      ) | Out-Null
    }
  }
}

if ($publishFolder) {
  $env:UNDERTOW_PUBLISH_DIR = $publishFolder
  Write-Host "GitHub Pages publishing folder: $publishFolder"
} else {
  $env:UNDERTOW_PUBLISH_DIR = $appFolder
  Write-Host 'No GitHub Pages publishing folder selected. Universal changes will only save locally.'
}

& $NodeExecutable (Join-Path $appFolder 'admin-server.js')
exit $LASTEXITCODE

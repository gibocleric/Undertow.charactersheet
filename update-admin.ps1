$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$source = (Resolve-Path -LiteralPath $PSScriptRoot).Path
function Start-UndertowAdmin([string]$folder) {
  $batch = Join-Path $folder 'start-admin.bat'
  $arguments = '/c "' + $batch + '"'
  Start-Process -FilePath $env:ComSpec -ArgumentList $arguments -WorkingDirectory $folder -WindowStyle Normal
}
$picker = New-Object System.Windows.Forms.FolderBrowserDialog
$picker.Description = 'Choose the folder used by your current Undertow admin service.'
$picker.ShowNewFolderButton = $false
if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
$target = (Resolve-Path -LiteralPath $picker.SelectedPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $target 'admin-server.js'))) {
  [System.Windows.Forms.MessageBox]::Show('That folder does not contain admin-server.js. Choose the folder where your current Undertow admin service files are located.', 'Undertow updater', 'OK', 'Warning') | Out-Null
  exit 1
}
if ($source.TrimEnd('\') -ieq $target.TrimEnd('\')) {
  [System.Windows.Forms.MessageBox]::Show('The selected folder already contains this package, so no copying is needed. I will start the admin service from this folder now. To update a different older install, extract the ZIP to a new folder and select that older folder instead.', 'Undertow updater', 'OK', 'Information') | Out-Null
  Start-UndertowAdmin $target
  exit 0
}
foreach ($file in @('index.html', 'admin-server.js', 'start-admin.bat', 'update-admin.bat', 'update-admin.ps1', 'README.md')) {
  Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $target $file) -Force
}
if (-not (Test-Path -LiteralPath (Join-Path $target 'community-trees.json'))) {
  Copy-Item -LiteralPath (Join-Path $source 'community-trees.json') -Destination $target
}
if (-not (Test-Path -LiteralPath (Join-Path $target 'site-config.json'))) {
  Copy-Item -LiteralPath (Join-Path $source 'site-config.json') -Destination $target
}
foreach ($folder in @('assets', 'fonts')) {
  Copy-Item -LiteralPath (Join-Path $source $folder) -Destination $target -Recurse -Force
}
$ignorePath = Join-Path $target '.gitignore'
$ignoreText = if (Test-Path -LiteralPath $ignorePath) { Get-Content -LiteralPath $ignorePath -Raw } else { '' }
foreach ($entry in @('.admin-access.json', '*.tmp')) {
  if ($ignoreText -notmatch ('(?m)^' + [regex]::Escape($entry) + '$')) { Add-Content -LiteralPath $ignorePath -Value $entry }
}
[System.Windows.Forms.MessageBox]::Show('The new app and server files are now in the selected folder. Your local admin account and community tree catalog were kept. The updated service is starting now.', 'Undertow updater', 'OK', 'Information') | Out-Null
Start-UndertowAdmin $target

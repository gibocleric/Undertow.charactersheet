$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$source = $PSScriptRoot
$picker = New-Object System.Windows.Forms.FolderBrowserDialog
$picker.Description = 'Choose the folder used by your current Undertow admin service.'
$picker.ShowNewFolderButton = $false
if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
$target = (Resolve-Path -LiteralPath $picker.SelectedPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $target 'admin-server.js'))) {
  [System.Windows.Forms.MessageBox]::Show('That folder does not contain admin-server.js. Choose the folder where your current Undertow admin service files are located.', 'Undertow updater', 'OK', 'Warning') | Out-Null
  exit 1
}
if ((Resolve-Path -LiteralPath $source).Path -eq $target) {
  [System.Windows.Forms.MessageBox]::Show('This is already the new package folder. The updated launcher will start this copy.', 'Undertow updater', 'OK', 'Information') | Out-Null
}
foreach ($file in @('index.html', 'admin-server.js', 'start-admin.bat', 'README.md')) {
  Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $target $file) -Force
}
if (-not (Test-Path -LiteralPath (Join-Path $target 'community-trees.json'))) {
  Copy-Item -LiteralPath (Join-Path $source 'community-trees.json') -Destination $target
}
foreach ($folder in @('assets', 'fonts')) {
  Copy-Item -LiteralPath (Join-Path $source $folder) -Destination $target -Recurse -Force
}
$ignorePath = Join-Path $target '.gitignore'
$ignoreText = if (Test-Path -LiteralPath $ignorePath) { Get-Content -LiteralPath $ignorePath -Raw } else { '' }
foreach ($entry in @('.admin-access.json', '*.tmp')) {
  if ($ignoreText -notmatch ('(?m)^' + [regex]::Escape($entry) + '$')) { Add-Content -LiteralPath $ignorePath -Value $entry }
}
[System.Windows.Forms.MessageBox]::Show('The new app and server files are now in the selected folder. Your local admin account and community tree catalog were kept. The admin service will now start from the updated folder.', 'Undertow updater', 'OK', 'Information') | Out-Null
Start-Process -FilePath (Join-Path $target 'start-admin.bat') -WorkingDirectory $target

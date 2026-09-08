# Puts a Supermarket shortcut on your desktop. Run once:
#   powershell -ExecutionPolicy Bypass -File scripts\add-desktop-shortcut.ps1
$repo = Split-Path -Parent $PSScriptRoot
$target = Join-Path $repo 'start-supermarket.cmd'
$link = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Supermarket.lnk'

$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($link)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $repo
$shortcut.Description = 'Start Supermarket and open it in the browser'
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,44"
$shortcut.Save()

Write-Host "Added: $link"

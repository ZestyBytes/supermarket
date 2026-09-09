<#
  Makes Supermarket start with this computer and keep itself up to date.

  Registers a Scheduled Task that runs the supervisor at logon, minimised.
  A Scheduled Task rather than a Windows service on purpose: a service runs
  with no desktop session, and this wants the same account you use for Chrome,
  because that is where the Tesco extension lives.

    Install:  powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1
    Remove:   powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1 -Remove

  The supervisor itself is scripts\keep-running.mjs, and it runs on the Node
  this app already needs. Nothing else to install.
#>

[CmdletBinding()]
param(
  [switch] $Remove,
  [string] $TaskName = 'Supermarket',
  [int] $CheckMinutes = 10
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$supervisor = Join-Path $PSScriptRoot 'keep-running.mjs'

if ($Remove) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host 'Removed. Supermarket will no longer start on its own.' -ForegroundColor Cyan
  return
}

if (-not (Test-Path $supervisor)) { throw "Cannot find $supervisor" }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Node is not on the PATH. Install Node, then run this again.' }

$action = New-ScheduledTaskAction -Execute $node `
  -Argument "`"$supervisor`" --checkMinutes=$CheckMinutes" -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Never stop it for running a long time, and do not refuse to start it on a
# laptop that happens to be on battery: staying up is the entire point.
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Keeps Supermarket running and up to date with GitHub.' -Force | Out-Null

Write-Host 'Installed.' -ForegroundColor Green
Write-Host "  Supermarket starts when you log in, and checks GitHub every $CheckMinutes minutes."
Write-Host "  Start it now:  Start-ScheduledTask -TaskName $TaskName"
Write-Host "  Stop it:       Stop-ScheduledTask -TaskName $TaskName"
Write-Host "  Remove it:     powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1 -Remove"
Write-Host ''
Write-Host '  One thing this does not do: the Tesco connection.' -ForegroundColor Yellow
Write-Host "  Open the Supermarket extension in Chrome and tick 'Stay connected'." -ForegroundColor Yellow
Write-Host '  It then mints a fresh token every half hour on its own.' -ForegroundColor Yellow

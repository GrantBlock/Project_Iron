# Send a nightly feature spec run report to Project Chat.
# Example:
#   .\send-report.ps1 -Status pass -Title "Feature spec run #42" -Summary "38/40 specs passed" -BodyFile .\run-report.md
param(
  [string]$Server = "http://localhost:3500",
  [string]$Token = $env:PROJECT_CHAT_TOKEN,      # reportToken from config.json
  [string]$Project = "project-iron",
  [string]$Agent = "Lydia",
  [ValidateSet("pass","fail","partial","info")][string]$Status = "info",
  [string]$Title = "Nightly feature spec run",
  [string]$Summary = "",
  [string]$BodyFile = "",
  [int]$Passed = -1, [int]$Failed = -1, [int]$Skipped = -1,
  [string]$Link = ""
)
if (-not $Token) { Write-Error "Set -Token or the PROJECT_CHAT_TOKEN environment variable."; exit 1 }

$body = ""
if ($BodyFile -and (Test-Path $BodyFile)) { $body = Get-Content $BodyFile -Raw }

$stats = [ordered]@{}
if ($Passed -ge 0)  { $stats.passed  = $Passed }
if ($Failed -ge 0)  { $stats.failed  = $Failed }
if ($Skipped -ge 0) { $stats.skipped = $Skipped }

$payload = [ordered]@{
  project = $Project; agent = $Agent; status = $Status; title = $Title
  summary = $Summary; body = $body; runDate = (Get-Date -Format "yyyy-MM-dd"); link = $Link
}
if ($stats.Count) { $payload.stats = $stats }

Invoke-RestMethod -Method Post -Uri "$Server/api/reports" `
  -Headers @{ Authorization = "Bearer $Token" } `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 5)))

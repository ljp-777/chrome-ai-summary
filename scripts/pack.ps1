$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$out = Join-Path $root "chrome-ai-summary.zip"
$files = @(
  "manifest.json",
  "icons",
  "vendor",
  "src"
)
if (Test-Path $out) { Remove-Item $out -Force }
Push-Location $root
Compress-Archive -Path $files -DestinationPath $out -Force
Pop-Location
Write-Host "已生成: $out"

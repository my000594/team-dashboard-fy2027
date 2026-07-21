@echo off
chcp 65001 > nul

echo ================================================
echo  3SE Report CSV Update Tool
echo ================================================
echo.

set DASHBOARD_DIR=%~dp0
set DATA_DIR=%DASHBOARD_DIR%data
set DOWNLOAD_DIR=%USERPROFILE%\Downloads

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dataDir='%DATA_DIR%';$dlDir='%DOWNLOAD_DIR%';" ^
  "$tempDir=Join-Path $env:TEMP 'notion_3se_tmp';" ^
  "if(Test-Path $tempDir){Remove-Item $tempDir -Recurse -Force};" ^
  "New-Item -ItemType Directory -Path $tempDir|Out-Null;" ^
  "$zips=Get-ChildItem -Path $dlDir -Filter '*ExportBlock*.zip'|Sort-Object LastWriteTime -Descending;" ^
  "if($zips.Count -eq 0){Write-Host '[ERROR] No ExportBlock*.zip found.' -ForegroundColor Red;exit 1};" ^
  "Write-Host \"  Found $($zips.Count) ZIP(s). Checking...\";" ^
  "$foundCsv=$null;" ^
  "foreach($zip in $zips){" ^
  "  $workDir=Join-Path $tempDir $zip.BaseName;" ^
  "  New-Item -ItemType Directory -Path $workDir -Force|Out-Null;" ^
  "  Expand-Archive -Path $zip.FullName -DestinationPath $workDir -Force 2>`$null;" ^
  "  Get-ChildItem -Path $workDir -Filter '*.zip' -Recurse|ForEach-Object{Expand-Archive -Path $_.FullName -DestinationPath $workDir -Force 2>`$null};" ^
  "  $csvFiles=Get-ChildItem -Path $workDir -Filter '*.csv' -Recurse;" ^
  "  foreach($csv in $csvFiles){" ^
  "    $header=Get-Content $csv.FullName -First 1 -Encoding UTF8 -ErrorAction SilentlyContinue;" ^
  "    if($header -match '達成状況'){Write-Host \"  Match: $($zip.Name)\" -ForegroundColor Green;$foundCsv=$csv.FullName;break}" ^
  "  };if($foundCsv){break}" ^
  "};" ^
  "if(-not $foundCsv){Write-Host '[ERROR] No 3SE CSV found.' -ForegroundColor Red;Remove-Item $tempDir -Recurse -Force;exit 1};" ^
  "Copy-Item -Path $foundCsv -Destination (Join-Path $dataDir '3se_report.csv') -Force;" ^
  "(Get-Item (Join-Path $dataDir '3se_report.csv')).LastWriteTime=Get-Date;" ^
  "Remove-Item $tempDir -Recurse -Force;" ^
  "Write-Host '';Write-Host '================================================';" ^
  "Write-Host ' Done! 3se_report.csv updated.';" ^
  "Write-Host ' Next: Deploy to Cloudflare Pages.';" ^
  "Write-Host '================================================'"

if errorlevel 1 (pause & exit /b 1)
echo.
explorer "%DASHBOARD_DIR%"
pause

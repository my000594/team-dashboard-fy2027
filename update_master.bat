@echo off
chcp 65001 > nul

echo ================================================
echo  Member Master Update Tool
echo ================================================
echo.

set DASHBOARD_DIR=%~dp0
set DATA_DIR=%DASHBOARD_DIR%data\members
set DOWNLOAD_DIR=%USERPROFILE%\Downloads

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dataDir='%DATA_DIR%';$dlDir='%DOWNLOAD_DIR%';" ^
  "$tempDir=Join-Path $env:TEMP 'notion_master_tmp';" ^
  "if(Test-Path $tempDir){Remove-Item $tempDir -Recurse -Force};" ^
  "New-Item -ItemType Directory -Path $tempDir|Out-Null;" ^
  "$zips=Get-ChildItem -Path $dlDir -Filter '*ExportBlock*.zip'|Sort-Object LastWriteTime -Descending;" ^
  "if($zips.Count -eq 0){Write-Host '[ERROR] No ExportBlock*.zip found.' -ForegroundColor Red;exit 1};" ^
  "Write-Host \"  Found $($zips.Count) ZIP(s). Checking...\";" ^
  "$foundCsv=$null;$foundImgDir=$null;" ^
  "foreach($zip in $zips){" ^
  "  $workDir=Join-Path $tempDir $zip.BaseName;" ^
  "  New-Item -ItemType Directory -Path $workDir -Force|Out-Null;" ^
  "  Expand-Archive -Path $zip.FullName -DestinationPath $workDir -Force 2>`$null;" ^
  "  Get-ChildItem -Path $workDir -Filter '*.zip' -Recurse|ForEach-Object{Expand-Archive -Path $_.FullName -DestinationPath $workDir -Force 2>`$null};" ^
  "  $csvFiles=Get-ChildItem -Path $workDir -Filter '*.csv' -Recurse|Where-Object{$_.Name -notmatch '_all\.csv$'};" ^
  "  foreach($csv in $csvFiles){" ^
  "    $header=Get-Content $csv.FullName -First 1 -Encoding UTF8 -ErrorAction SilentlyContinue;" ^
  "    if($header -match '社員番号'){Write-Host \"  Match: $($zip.Name)\" -ForegroundColor Green;$foundCsv=$csv.FullName;$foundImgDir=$csv.DirectoryName;break}" ^
  "  };if($foundCsv){break}" ^
  "};" ^
  "if(-not $foundCsv){Write-Host '[ERROR] No member CSV found.' -ForegroundColor Red;Remove-Item $tempDir -Recurse -Force;exit 1};" ^
  "Copy-Item -Path $foundCsv -Destination (Join-Path $dataDir 'member_master.csv') -Force;" ^
  "(Get-Item (Join-Path $dataDir 'member_master.csv')).LastWriteTime=Get-Date;" ^
  "Write-Host '  member_master.csv updated.';" ^
  "$existingImgs=@(Get-ChildItem -Path $dataDir -File|Where-Object{$_.Extension -match '\.(png|jpg|jpeg)$'});" ^
  "if($existingImgs.Count -eq 0){" ^
  "  Write-Host '  No images - copying for the first time...';" ^
  "  $imgs=@(Get-ChildItem -Path $foundImgDir -File|Where-Object{$_.Extension -match '\.(png|jpg|jpeg)$'});" ^
  "  $count=0;foreach($img in $imgs){Copy-Item -Path $img.FullName -Destination $dataDir -Force;$count++};" ^
  "  if($count -eq 0){Write-Host '  No images in ZIP. Add photos manually.' -ForegroundColor Yellow}" ^
  "  else{Write-Host \"  $count image(s) copied.\" -ForegroundColor Green}" ^
  "}else{Write-Host \"  Images exist ($($existingImgs.Count)) - skipping.\"};" ^
  "Remove-Item $tempDir -Recurse -Force;" ^
  "Write-Host '';Write-Host '================================================';" ^
  "Write-Host ' Done! member_master.csv updated.';" ^
  "Write-Host ' Next: Deploy to Cloudflare Pages.';" ^
  "Write-Host '================================================'"

if errorlevel 1 (pause & exit /b 1)
echo.
explorer "%DATA_DIR%"
pause

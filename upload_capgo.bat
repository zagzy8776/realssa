@echo off
cd /d "%~dp0"
echo Building the web bundle...
call npm run build
echo Uploading to Capgo...
call npx "@capgo/cli@latest" bundle upload com.realssa.news --path ./dist --channel production --version 0.0.45
echo Done!
pause

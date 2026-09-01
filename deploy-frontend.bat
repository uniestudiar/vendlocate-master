@echo off
echo === Deploying Frontend to Vercel ===
echo.
echo Step 1: Building...
call npx vite build
if %errorlevel% neq 0 (
  echo Build failed! Fix errors and try again.
  pause
  exit /b 1
)
echo Build successful!
echo.
echo Step 2: Deploying to Vercel...
echo Note: First time will ask you to log in with GitHub/Google.
echo.
cd dist
npx vercel --prod
cd ..
echo.
echo Done! Your site URL will be shown above.
echo.
pause

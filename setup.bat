@echo off
title Interlace — Setup
color 0A
echo.
echo  ==========================================
echo   Interlace Migration Intelligence
echo   Full-Stack Setup
echo  ==========================================
echo.

echo [1/3] Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 ( echo ERROR: npm install failed & pause & exit /b 1 )
cd ..
echo [OK] Frontend ready

echo.
echo [2/3] Installing backend dependencies...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 ( echo ERROR: pip install failed & pause & exit /b 1 )
cd ..
echo [OK] Backend ready

echo.
echo [3/3] Setting up .env...
if not exist .env ( copy .env.example .env & echo [OK] .env created ) else ( echo [OK] .env exists )

echo.
echo  ==========================================
echo   Done! To run:
echo.
echo   Terminal 1 (Frontend):
echo     cd frontend
echo     npm run dev
echo     → http://localhost:3000
echo.
echo   Terminal 2 (Backend):
echo     cd backend
echo     uvicorn main:app --reload
echo     → http://localhost:8000/docs
echo  ==========================================
echo.
pause

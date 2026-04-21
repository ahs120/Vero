@echo off
title Vero Admin - Run Project

echo ==============================
echo Starting Vero Admin Project...
echo ==============================

REM Go to project directory
cd /d %~dp0

REM Check if node_modules exists
if not exist node_modules (
    echo.
    echo 📦 Installing dependencies...
    echo.
    call npm install
)

echo.
echo 🚀 Starting server in development mode...
echo.

REM Try npx nodemon (local) first, then npm start
call npx nodemon server.js || npm start

echo.
echo ==============================
echo Project stopped.
echo ==============================

pause
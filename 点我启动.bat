@echo off
chcp 65001 >nul
cd /d %~dp0
cd fold
echo %~dp0
call npm install
echo.
echo 依赖安装完成，正在启动服务端...
start http://localhost:17923
start cmd /k "cd /d %~dp0fold && node server.js"
timeout /t 3
exit
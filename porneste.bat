@echo off
rem ============================================================
rem  Porneste PAL Calc pe calculatorul asta.
rem
rem  Se apasa de doua ori pe fisier. Se deschide o fereastra
rem  neagra si, dupa cateva secunde, aplicatia in browser.
rem
rem  Fereastra neagra TREBUIE lasata deschisa: in ea merge
rem  aplicatia. Cand o inchizi, se opreste si ea.
rem
rem  Fara diacritice inadins: consola Windows nu le arata
rem  intotdeauna cum trebuie, si ar iesi semne ciudate.
rem ============================================================

cd /d "%~dp0"
title PAL Calc - lasa fereastra asta deschisa

echo.
echo   PAL Calc porneste...
echo.
echo   Se deschide singur in browser, la http://localhost:3000
echo   Daca nu se deschide, scrie tu adresa aia in browser.
echo.
echo   CA SA OPRESTI: inchide fereastra asta.
echo.

rem Browserul se deschide dupa trei secunde, cat ii ia serverului sa fie
rem gata. Daca l-am deschide acum, ar da "nu se poate conecta".
rem
rem Se face prin PowerShell, nu prin "start" in "start": acolo ghilimelele
rem se incurca intre ele si linia crapa pe unele masini.
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"

node server.js

echo.
echo   Aplicatia s-a oprit.
echo.
pause >nul

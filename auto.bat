@echo off

chcp 65001 > nul

title Smoke Monitoring Ecommerce

cd /d E:\Sistemas\ecommerce2-smoke

echo ==================================
echo INICIANDO SMOKE TEST ENOVA
echo %date% %time%
echo ==================================

echo. > smoke-last.log

powershell "npx playwright test 2>&1 | Tee-Object -FilePath smoke-last.log"

echo. >> smoke-history.log
echo ================================== >> smoke-history.log
echo INICIO TEST: %date% %time% >> smoke-history.log
echo ================================== >> smoke-history.log

type smoke-last.log >> smoke-history.log

echo ================================== >> smoke-history.log
echo FIN TEST: %date% %time% >> smoke-history.log
echo ================================== >> smoke-history.log

echo.
echo ==================================
echo SMOKE TEST FINALIZADO
echo %date% %time%
echo ==================================

pause
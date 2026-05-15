@echo off

cd /d d:\Sistemas\ecommerce2-smoke

npx playwright test > smoke-log.txt 2>&1
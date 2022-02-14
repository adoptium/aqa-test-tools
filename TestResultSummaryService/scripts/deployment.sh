#!/bin/sh
set -e

echo "Stop both frontend and backend service"
sudo service TRSSFrontend stop
sudo service TRSSBackend stop


echo "Sync with https://github.com/adoptium/aqa-test-tools.git"
cd ../..
git pull

echo "Update TRSS client..."
cd test-result-summary-client
echo "npm ci --production"
npm ci --production
echo "npm run build"
npm run build

echo "Update TRSS server..."
cd ../TestResultSummaryService
echo "npm ci --production"
npm ci --production

echo "Start both frontend and backend service"
sudo service TRSSBackend start
sudo service TRSSFrontend start

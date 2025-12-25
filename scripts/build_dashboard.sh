#!/bin/bash
# scripts/build_dashboard.sh
# Rebuilds the Studio OS frontend and restarts the backend

echo "--- Rebuilding Frontend (admin/web) ---"
cd admin/web || exit
npm run build

echo "--- Restarting Backend (uvicorn) ---"
lsof -ti:8000 | xargs kill -9 2>/dev/null
cd ../.. || exit
uvicorn admin.api.main:app --host 0.0.0.0 --port 8000 &

echo "--- Dashboard Build Complete ---"

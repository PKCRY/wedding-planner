#!/bin/bash
# Kill any existing dev server on port 3000, then start fresh
echo "Stopping any existing dev server..."
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 1
echo "Starting dev server..."
npm run dev

#!/bin/bash
# Script to kill process on port 5000

PORT=${1:-5000}
PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
  echo "✅ Port $PORT is free"
  exit 0
fi

echo "🔍 Found process $PID on port $PORT"
kill -9 $PID 2>/dev/null
sleep 1

if lsof -ti:$PORT > /dev/null 2>&1; then
  echo "❌ Failed to kill process on port $PORT"
  exit 1
else
  echo "✅ Port $PORT is now free"
  exit 0
fi


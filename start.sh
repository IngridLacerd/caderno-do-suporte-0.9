#!/bin/bash
set -e

# Start Express server in background
node server.js &
EXPRESS_PID=$!

# Give Express a moment to start
sleep 2

# Start Caddy in foreground (this will be the main process)
caddy run --config Caddyfile --adapter caddyfile

# If Caddy exits, kill Express too
kill $EXPRESS_PID 2>/dev/null || true

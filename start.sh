#!/bin/bash

# Railway sets RAILWAY_SERVICE_NAME to identify which service is deploying
# This script starts the appropriate app based on the service name

if [ "$RAILWAY_SERVICE_NAME" = "api" ]; then
  echo "Starting API service..."
  cd apps/api && pnpm start
elif [ "$RAILWAY_SERVICE_NAME" = "web" ]; then
  echo "Starting Web service..."
  cd apps/web && pnpm start
else
  echo "Error: Unknown service name: $RAILWAY_SERVICE_NAME"
  echo "Expected 'api' or 'web'"
  exit 1
fi

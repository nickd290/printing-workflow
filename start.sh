#!/bin/bash
set -e  # Exit on error

echo "========================================="
echo "🚀 Railway Deployment Startup Script"
echo "========================================="
echo "Timestamp: $(date)"
echo "Current directory: $(pwd)"
echo "Railway Service Name: ${RAILWAY_SERVICE_NAME:-NOT_SET}"
echo "Node Environment: ${NODE_ENV:-NOT_SET}"
echo "-----------------------------------------"

# Show directory structure
echo "📁 Directory structure:"
ls -la
echo "-----------------------------------------"

# Show environment variables (sanitized)
echo "🔧 Environment Variables (sanitized):"
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."
echo "NEXTAUTH_URL: ${NEXTAUTH_URL:-NOT_SET}"
echo "NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:0:10}..."
echo "API_URL: ${API_URL:-NOT_SET}"
echo "NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-NOT_SET}"
echo "PORT: ${PORT:-NOT_SET}"
echo "API_PORT: ${API_PORT:-NOT_SET}"
echo "-----------------------------------------"

# Check if apps directory exists
if [ ! -d "apps" ]; then
  echo "❌ ERROR: 'apps' directory not found!"
  echo "Files in current directory:"
  ls -la
  exit 1
fi

# Start the appropriate service
if [ "$RAILWAY_SERVICE_NAME" = "api" ]; then
  echo "🔵 Starting API service..."
  echo "Checking apps/api directory..."
  ls -la apps/api || echo "Warning: Could not list apps/api"

  echo "Changing to apps/api directory..."
  cd apps/api

  echo "Current directory: $(pwd)"
  echo "Files in directory:"
  ls -la

  echo "Running: pnpm start"
  exec pnpm start

elif [ "$RAILWAY_SERVICE_NAME" = "web" ]; then
  echo "🟢 Starting Web service..."
  echo "Checking apps/web directory..."
  ls -la apps/web || echo "Warning: Could not list apps/web"

  echo "Changing to apps/web directory..."
  cd apps/web

  echo "Current directory: $(pwd)"
  echo "Files in directory:"
  ls -la

  echo "Running: pnpm start"
  exec pnpm start

else
  echo "❌ ERROR: Unknown service name: $RAILWAY_SERVICE_NAME"
  echo "Expected 'api' or 'web'"
  echo "All environment variables:"
  env | sort
  exit 1
fi

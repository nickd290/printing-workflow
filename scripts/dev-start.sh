#!/bin/bash

# Development server startup script
# Ensures clean startup of API and Web servers with proper health checks
#
# Usage:
#   ./dev-start.sh              # Start all servers
#   ./dev-start.sh --api-only   # Start only API server
#   ./dev-start.sh --web-only   # Start only Web server
#   ./dev-start.sh --skip-cleanup # Skip port cleanup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_PORT=3001
WEB_PORT=5175
API_HEALTH_ENDPOINT="http://localhost:${API_PORT}/health"
WEB_URL="http://localhost:${WEB_PORT}"

# Flags
START_API=true
START_WEB=true
SKIP_CLEANUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-only)
      START_WEB=false
      shift
      ;;
    --web-only)
      START_API=false
      shift
      ;;
    --skip-cleanup)
      SKIP_CLEANUP=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --api-only       Start only the API server"
      echo "  --web-only       Start only the Web server"
      echo "  --skip-cleanup   Skip port cleanup step"
      echo "  --help, -h       Show this help message"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🚀 Starting Printing Workflow Development Environment${NC}"
echo ""

# Step 1: Clean up ports
if [ "$SKIP_CLEANUP" = false ]; then
  echo -e "${YELLOW}Step 1: Cleaning up ports...${NC}"
  bash "$SCRIPT_DIR/cleanup-ports.sh"
  echo ""
else
  echo -e "${YELLOW}Step 1: Skipping port cleanup${NC}"
  echo ""
fi

# Step 2: Check environment
echo -e "${YELLOW}Step 2: Checking environment...${NC}"

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo -e "${RED}  ✗ .env file not found!${NC}"
  echo -e "  ${BLUE}Tip:${NC} Copy .env.example to .env and configure it"
  exit 1
fi

echo -e "${GREEN}  ✓${NC} .env file found"

# Check DATABASE_URL
if ! grep -q "^DATABASE_URL=" "$PROJECT_ROOT/.env"; then
  echo -e "${RED}  ✗ DATABASE_URL not set in .env!${NC}"
  exit 1
fi

DATABASE_URL=$(grep "^DATABASE_URL=" "$PROJECT_ROOT/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
echo -e "${GREEN}  ✓${NC} DATABASE_URL configured"

# Check if database file exists (for SQLite)
if [[ $DATABASE_URL == file:* ]]; then
  DB_PATH="${DATABASE_URL#file:}"
  DB_PATH="${PROJECT_ROOT}/${DB_PATH}"
  if [ ! -f "$DB_PATH" ]; then
    echo -e "${YELLOW}  ⚠${NC}  Database file doesn't exist: $DB_PATH"
    echo -e "  ${BLUE}Tip:${NC} Run 'npm run db:push' to create it"
  else
    echo -e "${GREEN}  ✓${NC} Database file exists"
  fi
fi

echo ""

# Step 3: Ensure Prisma client is generated
echo -e "${YELLOW}Step 3: Ensuring Prisma client is up to date...${NC}"
cd "$PROJECT_ROOT/packages/db"
npx prisma generate > /dev/null 2>&1 || true
echo -e "${GREEN}  ✓${NC} Prisma client generated"
echo ""

# Step 4: Start servers
echo -e "${YELLOW}Step 4: Starting servers...${NC}"
echo ""

# Function to wait for server health
wait_for_health() {
  local url=$1
  local name=$2
  local max_attempts=30
  local attempt=1

  echo -e "${BLUE}  Waiting for $name to be healthy...${NC}"

  while [ $attempt -le $max_attempts ]; do
    if curl -s -f "$url" > /dev/null 2>&1; then
      echo -e "${GREEN}  ✓ $name is healthy!${NC}"
      return 0
    fi

    printf "    Attempt %d/%d...\r" $attempt $max_attempts
    sleep 1
    ((attempt++))
  done

  echo -e "${RED}  ✗ $name failed to start${NC}"
  return 1
}

# Start API server
if [ "$START_API" = true ]; then
  echo -e "${BLUE}📡 Starting API server on port ${API_PORT}...${NC}"
  cd "$PROJECT_ROOT/apps/api"

  # Start in background
  npm run dev > "$PROJECT_ROOT/logs/api.log" 2>&1 &
  API_PID=$!
  echo "  Started with PID: $API_PID"

  # Wait for health check
  if wait_for_health "$API_HEALTH_ENDPOINT" "API"; then
    echo ""
  else
    echo -e "${RED}  Check logs at: $PROJECT_ROOT/logs/api.log${NC}"
    echo ""
    exit 1
  fi
fi

# Start Web server
if [ "$START_WEB" = true ]; then
  echo -e "${BLUE}🌐 Starting Web server on port ${WEB_PORT}...${NC}"
  cd "$PROJECT_ROOT/apps/web"

  # Start in background
  npm run dev > "$PROJECT_ROOT/logs/web.log" 2>&1 &
  WEB_PID=$!
  echo "  Started with PID: $WEB_PID"

  # Wait a bit for Next.js to start
  echo -e "${BLUE}  Waiting for Web server...${NC}"
  sleep 5
  echo -e "${GREEN}  ✓ Web server started!${NC}"
  echo ""
fi

# Step 5: Summary
echo ""
echo -e "${GREEN}✅ Development environment started successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Server Status:${NC}"

if [ "$START_API" = true ]; then
  echo -e "  API Server:  ${GREEN}http://localhost:${API_PORT}${NC} (PID: $API_PID)"
fi

if [ "$START_WEB" = true ]; then
  echo -e "  Web Server:  ${GREEN}http://localhost:${WEB_PORT}${NC} (PID: $WEB_PID)"
fi

echo ""
echo -e "${BLUE}📝 Logs:${NC}"
if [ "$START_API" = true ]; then
  echo -e "  API: tail -f $PROJECT_ROOT/logs/api.log"
fi
if [ "$START_WEB" = true ]; then
  echo -e "  Web: tail -f $PROJECT_ROOT/logs/web.log"
fi

echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo -e "  • Run ${YELLOW}./scripts/dev-status.sh${NC} to check server status"
echo -e "  • Run ${YELLOW}./scripts/cleanup-ports.sh${NC} to stop all servers"
echo -e "  • Logs are written to ${YELLOW}logs/${NC} directory"
echo ""

#!/bin/bash

# Development server status checker
# Shows current status of API and Web servers, port usage, and recent logs
#
# Usage:
#   ./dev-status.sh           # Show status dashboard
#   ./dev-status.sh --watch   # Watch mode (refreshes every 5s)
#   ./dev-status.sh --logs    # Show recent logs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_PORT=3001
WEB_PORT=5175
API_HEALTH_ENDPOINT="http://localhost:${API_PORT}/health"
WEB_URL="http://localhost:${WEB_PORT}"

# Flags
WATCH_MODE=false
SHOW_LOGS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --watch|-w)
      WATCH_MODE=true
      shift
      ;;
    --logs|-l)
      SHOW_LOGS=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --watch, -w   Watch mode (refresh every 5 seconds)"
      echo "  --logs, -l    Show recent logs from servers"
      echo "  --help, -h    Show this help message"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Function to check if server is running on port
check_port() {
  local port=$1
  lsof -ti:$port 2>/dev/null
}

# Function to check API health
check_api_health() {
  local response=$(curl -s -w "\n%{http_code}" "$API_HEALTH_ENDPOINT" 2>/dev/null || echo "000")
  local body=$(echo "$response" | head -n -1)
  local status=$(echo "$response" | tail -n 1)

  if [ "$status" = "200" ]; then
    echo -e "${GREEN}✓ Healthy${NC}"
    return 0
  else
    echo -e "${RED}✗ Unhealthy${NC}"
    return 1
  fi
}

# Function to get process info
get_process_info() {
  local pid=$1
  if [ -z "$pid" ]; then
    echo "Not running"
    return 1
  fi

  local cmd=$(ps -p $pid -o command= 2>/dev/null || echo "")
  if [ -z "$cmd" ]; then
    echo "Process not found"
    return 1
  fi

  local cpu=$(ps -p $pid -o %cpu= 2>/dev/null || echo "0")
  local mem=$(ps -p $pid -o %mem= 2>/dev/null || echo "0")
  local time=$(ps -p $pid -o time= 2>/dev/null || echo "0:00")

  echo "PID: $pid | CPU: ${cpu}% | MEM: ${mem}% | TIME: $time"
  return 0
}

# Function to display status
show_status() {
  clear

  echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║         ${BLUE}Printing Workflow - Development Status${CYAN}         ║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # API Server Status
  echo -e "${BLUE}📡 API Server (Port ${API_PORT}):${NC}"
  API_PID=$(check_port $API_PORT)

  if [ ! -z "$API_PID" ]; then
    echo -e "   Status:  $(check_api_health)"
    echo -e "   Process: $(get_process_info $API_PID)"
    echo -e "   URL:     ${GREEN}$API_HEALTH_ENDPOINT${NC}"

    # Show listening addresses
    LISTEN=$(lsof -i:$API_PORT 2>/dev/null | grep LISTEN | awk '{print $9}' | sort -u)
    if [ ! -z "$LISTEN" ]; then
      echo -e "   Listening: $LISTEN"
    fi
  else
    echo -e "   Status:  ${RED}✗ Not running${NC}"
  fi

  echo ""

  # Web Server Status
  echo -e "${BLUE}🌐 Web Server (Port ${WEB_PORT}):${NC}"
  WEB_PID=$(check_port $WEB_PORT)

  if [ ! -z "$WEB_PID" ]; then
    echo -e "   Status:  ${GREEN}✓ Running${NC}"
    echo -e "   Process: $(get_process_info $WEB_PID)"
    echo -e "   URL:     ${GREEN}$WEB_URL${NC}"

    # Show listening addresses
    LISTEN=$(lsof -i:$WEB_PORT 2>/dev/null | grep LISTEN | awk '{print $9}' | sort -u)
    if [ ! -z "$LISTEN" ]; then
      echo -e "   Listening: $LISTEN"
    fi
  else
    echo -e "   Status:  ${RED}✗ Not running${NC}"
  fi

  echo ""

  # Database Status
  echo -e "${BLUE}🗄️  Database:${NC}"
  if [ -f "$PROJECT_ROOT/.env" ]; then
    DATABASE_URL=$(grep "^DATABASE_URL=" "$PROJECT_ROOT/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")

    if [[ $DATABASE_URL == file:* ]]; then
      DB_PATH="${DATABASE_URL#file:}"
      DB_PATH="${PROJECT_ROOT}/${DB_PATH}"

      if [ -f "$DB_PATH" ]; then
        SIZE=$(du -h "$DB_PATH" | cut -f1)
        echo -e "   Type:    SQLite"
        echo -e "   Path:    $DB_PATH"
        echo -e "   Size:    $SIZE"
        echo -e "   Status:  ${GREEN}✓ File exists${NC}"
      else
        echo -e "   Type:    SQLite"
        echo -e "   Status:  ${RED}✗ File not found${NC}"
      fi
    else
      echo -e "   URL:     ${DATABASE_URL:0:30}..."
      echo -e "   Status:  ${YELLOW}? External database${NC}"
    fi
  else
    echo -e "   Status:  ${RED}✗ .env not found${NC}"
  fi

  echo ""

  # All Node processes
  echo -e "${BLUE}🔍 All Node/tsx Processes:${NC}"
  NODE_PROCS=$(ps aux | grep -E "(node|tsx)" | grep -v grep | grep -v "$0" | wc -l | tr -d ' ')

  if [ "$NODE_PROCS" -gt 0 ]; then
    echo -e "   Count:   ${YELLOW}$NODE_PROCS processes${NC}"

    # Show top 5 by memory
    echo -e "   Top 5 by memory:"
    ps aux | grep -E "(node|tsx)" | grep -v grep | grep -v "$0" | sort -k4 -r | head -5 | while read line; do
      PID=$(echo $line | awk '{print $2}')
      MEM=$(echo $line | awk '{print $4}')
      CMD=$(echo $line | awk '{for(i=11;i<=NF;i++) printf $i" "; print ""}' | cut -c1-50)
      echo -e "     • PID $PID - ${MEM}% - $CMD"
    done
  else
    echo -e "   Count:   ${GREEN}No processes${NC}"
  fi

  echo ""

  # Recent errors in logs
  if [ -d "$PROJECT_ROOT/logs" ]; then
    echo -e "${BLUE}📋 Recent Log Activity:${NC}"

    if [ -f "$PROJECT_ROOT/logs/api.log" ]; then
      API_ERRORS=$(grep -i "error" "$PROJECT_ROOT/logs/api.log" 2>/dev/null | tail -1 || echo "")
      if [ ! -z "$API_ERRORS" ]; then
        echo -e "   ${RED}API Error:${NC} ${API_ERRORS:0:60}..."
      else
        echo -e "   ${GREEN}API:${NC} No recent errors"
      fi
    fi

    if [ -f "$PROJECT_ROOT/logs/web.log" ]; then
      WEB_ERRORS=$(grep -i "error" "$PROJECT_ROOT/logs/web.log" 2>/dev/null | tail -1 || echo "")
      if [ ! -z "$WEB_ERRORS" ]; then
        echo -e "   ${RED}Web Error:${NC} ${WEB_ERRORS:0:60}..."
      else
        echo -e "   ${GREEN}Web:${NC} No recent errors"
      fi
    fi
  fi

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"

  if [ "$WATCH_MODE" = true ]; then
    echo -e "${YELLOW}Press Ctrl+C to exit watch mode${NC}"
    echo -e "Refreshing in 5 seconds..."
  fi
}

# Function to show recent logs
show_logs() {
  echo -e "${BLUE}📋 Recent Logs${NC}"
  echo ""

  if [ -f "$PROJECT_ROOT/logs/api.log" ]; then
    echo -e "${YELLOW}=== API Logs (last 20 lines) ===${NC}"
    tail -20 "$PROJECT_ROOT/logs/api.log"
    echo ""
  fi

  if [ -f "$PROJECT_ROOT/logs/web.log" ]; then
    echo -e "${YELLOW}=== Web Logs (last 20 lines) ===${NC}"
    tail -20 "$PROJECT_ROOT/logs/web.log"
    echo ""
  fi
}

# Main execution
if [ "$SHOW_LOGS" = true ]; then
  show_logs
  exit 0
fi

if [ "$WATCH_MODE" = true ]; then
  while true; do
    show_status
    sleep 5
  done
else
  show_status
fi

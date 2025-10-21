#!/bin/bash

# Cleanup script to kill zombie processes on development ports
# This prevents EADDRINUSE errors when restarting dev servers
#
# Usage:
#   ./cleanup-ports.sh              # Clean default ports (3001, 5175)
#   ./cleanup-ports.sh 3001         # Clean specific port
#   ./cleanup-ports.sh --verbose    # Verbose output with process details
#   ./cleanup-ports.sh --all        # Also clean orphaned node/tsx processes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default ports
DEFAULT_PORTS=(3001 5175)
VERBOSE=false
CLEAN_ALL=false
PORTS_TO_CLEAN=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --all|-a)
      CLEAN_ALL=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS] [PORTS...]"
      echo ""
      echo "Options:"
      echo "  --verbose, -v    Show detailed process information"
      echo "  --all, -a        Also clean orphaned node/tsx processes"
      echo "  --help, -h       Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                # Clean default ports (3001, 5175)"
      echo "  $0 3001           # Clean only port 3001"
      echo "  $0 3001 5175 8080 # Clean specific ports"
      echo "  $0 --verbose      # Verbose output"
      exit 0
      ;;
    [0-9]*)
      PORTS_TO_CLEAN+=("$1")
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Use default ports if none specified
if [ ${#PORTS_TO_CLEAN[@]} -eq 0 ]; then
  PORTS_TO_CLEAN=("${DEFAULT_PORTS[@]}")
fi

echo -e "${BLUE}🧹 Cleaning up ports: ${PORTS_TO_CLEAN[*]}${NC}"
echo ""

# Function to kill process on port
kill_port() {
  local port=$1
  local pids=$(lsof -ti:$port 2>/dev/null)

  if [ ! -z "$pids" ]; then
    if [ "$VERBOSE" = true ]; then
      echo -e "${YELLOW}Port $port in use by:${NC}"
      lsof -i:$port 2>/dev/null | grep LISTEN || true
      echo ""
    fi

    for pid in $pids; do
      local cmd=$(ps -p $pid -o command= 2>/dev/null || echo "unknown")
      echo -e "${GREEN}  ✓${NC} Killing process $pid on port $port"
      if [ "$VERBOSE" = true ]; then
        echo -e "    ${BLUE}Command:${NC} $cmd"
      fi
      kill -9 $pid 2>/dev/null || true
    done
  else
    echo -e "${GREEN}  ✓${NC} Port $port is free"
  fi
}

# Clean each port
for port in "${PORTS_TO_CLEAN[@]}"; do
  kill_port $port
done

# Clean orphaned processes if requested
if [ "$CLEAN_ALL" = true ]; then
  echo ""
  echo -e "${YELLOW}🔍 Checking for orphaned node/tsx processes...${NC}"

  ORPHANED=$(ps aux | grep -E "(node|tsx)" | grep -v grep | grep -v "$0" || true)
  if [ ! -z "$ORPHANED" ]; then
    echo -e "${YELLOW}Found orphaned processes:${NC}"
    echo "$ORPHANED"
    echo ""
    read -p "Kill these processes? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      killall -9 node tsx 2>/dev/null || true
      echo -e "${GREEN}  ✓${NC} Orphaned processes cleaned"
    else
      echo -e "${YELLOW}  ⊘${NC} Skipped orphaned process cleanup"
    fi
  else
    echo -e "${GREEN}  ✓${NC} No orphaned processes found"
  fi
fi

echo ""
echo -e "${GREEN}✅ Port cleanup complete!${NC}"

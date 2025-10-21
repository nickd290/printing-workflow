# Development Workflow Guide

## Overview

This guide explains the new development workflow for the printing-workflow project, which resolves port 3001 conflicts and provides better process management.

## Quick Start

### Starting Development Servers

**Recommended: Clean Start**
```bash
npm run start:clean
```

This command:
- Cleans up any processes using ports 3001/5175
- Checks environment and database configuration
- Generates Prisma client
- Starts API server and waits for health check
- Starts Web server
- Logs output to `logs/` directory

**Alternative: Traditional Methods**
```bash
# Use Turborepo (requires pnpm in PATH)
npm run dev

# Start all servers with concurrently
npm run dev:all

# Start individually
npm run --prefix apps/api dev    # API only
npm run --prefix apps/web dev    # Web only
```

## New npm Scripts

### Process Management

```bash
# Check server status
npm run status              # Show current status dashboard
npm run status:watch        # Watch mode (refreshes every 5s)
npm run status:logs         # Show recent logs

# Clean up ports
npm run clean               # Clean ports 3001 and 5175
npm run clean:all           # Also check for orphaned processes
```

### Development

```bash
npm run start:clean         # Clean start (recommended)
npm run dev                 # Turborepo dev mode
npm run dev:all             # Concurrently mode
npm run dev:workers         # Background workers only
```

### Database

```bash
npm run db:generate         # Generate Prisma client
npm run db:push             # Push schema to database
npm run db:migrate          # Create migration
npm run db:seed             # Seed database
npm run db:studio           # Open Prisma Studio
npm run db:reset            # Reset and reseed database
```

## New Scripts

### 1. `scripts/dev-start.sh`

Clean and reliable server startup with health checks.

**Features:**
- Automatic port cleanup
- Environment validation
- Database file existence check
- Prisma client generation
- API health check waiting
- Process logging to `logs/` directory

**Usage:**
```bash
./scripts/dev-start.sh                # Start all servers
./scripts/dev-start.sh --api-only     # Start only API
./scripts/dev-start.sh --web-only     # Start only Web
./scripts/dev-start.sh --skip-cleanup # Skip port cleanup
```

**Output:**
- Server status with PIDs
- URLs for accessing servers
- Log file locations
- Helpful tips

### 2. `scripts/dev-status.sh`

Real-time development server monitoring.

**Features:**
- API server status with health check
- Web server status
- Database information
- Process information (PID, CPU, Memory)
- Recent log errors
- All Node/tsx processes summary

**Usage:**
```bash
./scripts/dev-status.sh           # Show status once
./scripts/dev-status.sh --watch   # Watch mode (refresh every 5s)
./scripts/dev-status.sh --logs    # Show recent logs
```

**Dashboard Shows:**
- Server status (running/stopped)
- Health check results
- Process details (PID, CPU, RAM, uptime)
- Listening addresses
- Database status
- Recent errors from logs

### 3. `scripts/cleanup-ports.sh` (Enhanced)

Improved port cleanup with verbose output and options.

**New Features:**
- Colored output for clarity
- Process information display
- Custom port specification
- Orphaned process detection
- Help command

**Usage:**
```bash
./scripts/cleanup-ports.sh                # Clean default ports (3001, 5175)
./scripts/cleanup-ports.sh 3001           # Clean specific port
./scripts/cleanup-ports.sh 3001 8080      # Clean multiple ports
./scripts/cleanup-ports.sh --verbose      # Show process details
./scripts/cleanup-ports.sh --all          # Check for orphaned processes
./scripts/cleanup-ports.sh --help         # Show help
```

## Port Conflict Resolution

### Common Issues

**Problem:** "Error: listen EADDRINUSE: address already in use :::3001"

**Solutions:**

1. **Quick Fix:**
   ```bash
   npm run clean
   ```

2. **Nuclear Option:**
   ```bash
   npm run clean:all
   ```

3. **Manual Fix:**
   ```bash
   lsof -ti:3001 | xargs kill -9
   lsof -ti:5175 | xargs kill -9
   ```

4. **Check What's Running:**
   ```bash
   npm run status
   ```

### Prevention

1. Always use `npm run start:clean` for clean startup
2. Use `npm run clean` before switching branches
3. Check `npm run status` if things seem slow
4. Regularly review `npm run status` output

## Log Files

Logs are written to `logs/` directory (gitignored):

```
logs/
├── api.log    # API server logs
└── web.log    # Web server logs
```

**Viewing Logs:**
```bash
# Real-time
tail -f logs/api.log
tail -f logs/web.log

# Recent errors
npm run status:logs

# Search for errors
grep -i error logs/api.log
```

## Troubleshooting

### Servers Won't Start

1. Check port availability:
   ```bash
   npm run status
   ```

2. Clean ports:
   ```bash
   npm run clean
   ```

3. Verify environment:
   ```bash
   cat .env | grep DATABASE_URL
   ```

4. Check database:
   ```bash
   ls -lh packages/db/prisma/dev.db
   ```

5. Regenerate Prisma client:
   ```bash
   npm run db:generate
   ```

### Database Issues

**Schema out of sync:**
```bash
npm run db:generate
npm run db:push
```

**Need fresh start:**
```bash
npm run db:reset
```

**Inspect database:**
```bash
npm run db:studio
```

### Performance Issues

**Too many processes:**
```bash
npm run clean:all
```

**Check resource usage:**
```bash
npm run status
```

Look for high CPU/Memory usage in the process list.

## Best Practices

1. **Clean Start Every Morning:**
   ```bash
   npm run clean && npm run start:clean
   ```

2. **Monitor Regularly:**
   ```bash
   npm run status
   ```

3. **Check Logs for Errors:**
   ```bash
   npm run status:logs
   ```

4. **Before Pushing Code:**
   ```bash
   npm run clean     # Stop servers
   npm run build     # Verify builds
   npm run test      # Run tests
   ```

5. **When Switching Branches:**
   ```bash
   npm run clean              # Stop servers
   git checkout other-branch
   npm run db:generate        # Regenerate client
   npm run start:clean        # Clean start
   ```

## Architecture Notes

### Port Configuration

- **API Server:** Port 3001 (configurable via `API_PORT` in `.env`)
- **Web Server:** Port 5175 (hardcoded in `apps/web/package.json`)

### Process Management

- **API:** Uses `tsx watch` for hot reload
- **Web:** Uses Next.js dev server
- **Workers:** Run separately via `npm run dev:workers` (currently in synchronous mode)

### Health Checks

The API server exposes a health endpoint:
```
GET http://localhost:3001/health
```

The `dev-start.sh` script waits for this endpoint to return 200 before considering the API healthy.

## Migration from Old Workflow

### Old Way
```bash
# Had to manually kill processes
lsof -ti:3001 | xargs kill -9

# Start servers separately
cd apps/api && npm run dev &
cd apps/web && npm run dev &

# No easy way to check status
ps aux | grep node
```

### New Way
```bash
# One command for everything
npm run start:clean

# Easy status checking
npm run status

# Quick cleanup
npm run clean
```

## Future Improvements

Potential enhancements:
- PM2 integration for production-like management
- Automatic restart on crash
- Log rotation
- Health check alerts
- Integration with monitoring tools (Sentry, etc.)
- Git hooks for automatic cleanup

## Support

If you encounter issues not covered in this guide:

1. Check the logs: `npm run status:logs`
2. Try a clean restart: `npm run clean && npm run start:clean`
3. Verify environment: Check `.env` file exists and has `DATABASE_URL`
4. Check database: Ensure `packages/db/prisma/dev.db` exists
5. Regenerate Prisma: `npm run db:generate && npm run db:push`

For persistent issues, check:
- GitHub Issues: https://github.com/your-org/printing-workflow/issues
- Project README: `/README.md`
- Prisma docs: https://www.prisma.io/docs

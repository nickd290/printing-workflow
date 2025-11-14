#!/usr/bin/env tsx
/**
 * Start BullMQ workers and schedulers
 * Run this in a separate terminal: pnpm workers
 */
import './workers/index.js';
import { startDailyReportScheduler } from './scripts/daily-report-scheduler.js';

console.log('🔄 Workers are now running...');

// Start daily report scheduler
startDailyReportScheduler();

console.log('Press Ctrl+C to stop');

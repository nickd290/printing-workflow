/**
 * Structured Logging with Pino
 *
 * Production-ready logging system:
 * - JSON structured logs (parseable by log aggregators)
 * - Different log levels (trace, debug, info, warn, error, fatal)
 * - Pretty printing in development
 * - Performance optimized (minimal overhead)
 */

import pino from 'pino';
import { env } from '../env.js';

const isDevelopment = env.NODE_ENV === 'development';

// Create logger instance
export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined, // No transport in production (use JSON)

  // Base context included in all logs
  base: {
    env: env.NODE_ENV,
    service: 'printing-workflow-api',
  },

  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'password',
      'token',
      'apiKey',
      'secret',
    ],
    remove: true,
  },
});

/**
 * Create child logger with context
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log HTTP request
 */
export function logRequest(req: {
  method: string;
  url: string;
  headers: Record<string, any>;
  ip?: string;
}) {
  logger.info({
    type: 'http_request',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }, `${req.method} ${req.url}`);
}

/**
 * Log HTTP response
 */
export function logResponse(req: {
  method: string;
  url: string;
}, res: {
  statusCode: number;
  responseTime: number;
}) {
  const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

  logger[level]({
    type: 'http_response',
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: res.responseTime,
  }, `${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms`);
}

/**
 * Log database query
 */
export function logDatabaseQuery(query: {
  model: string;
  action: string;
  duration: number;
}) {
  logger.debug({
    type: 'database_query',
    ...query,
  }, `DB: ${query.model}.${query.action} (${query.duration}ms)`);
}

/**
 * Log email sent
 */
export function logEmail(params: {
  to: string;
  subject: string;
  success: boolean;
  error?: string;
}) {
  if (params.success) {
    logger.info({
      type: 'email_sent',
      to: params.to,
      subject: params.subject,
    }, `Email sent: ${params.subject}`);
  } else {
    logger.error({
      type: 'email_failed',
      to: params.to,
      subject: params.subject,
      error: params.error,
    }, `Email failed: ${params.subject}`);
  }
}

/**
 * Log error with stack trace
 */
export function logError(error: Error, context?: Record<string, any>) {
  logger.error({
    type: 'error',
    err: {
      type: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  }, error.message);
}

/**
 * Log security event
 */
export function logSecurityEvent(event: {
  type: 'auth_failed' | 'invalid_token' | 'rate_limit' | 'webhook_signature_failed';
  ip?: string;
  userId?: string;
  details?: Record<string, any>;
}) {
  logger.warn({
    type: 'security_event',
    ...event,
  }, `Security: ${event.type}`);
}

/**
 * Log business event
 */
export function logBusinessEvent(event: {
  type: 'job_created' | 'po_created' | 'invoice_sent' | 'proof_approved';
  jobId?: string;
  customerId?: string;
  amount?: number;
  details?: Record<string, any>;
}) {
  logger.info({
    type: 'business_event',
    ...event,
  }, `Business: ${event.type}`);
}

/**
 * Log performance metric
 */
export function logPerformance(metric: {
  name: string;
  duration: number;
  unit?: 'ms' | 's';
  details?: Record<string, any>;
}) {
  logger.info({
    type: 'performance',
    ...metric,
  }, `Performance: ${metric.name} took ${metric.duration}${metric.unit || 'ms'}`);
}

export default logger;

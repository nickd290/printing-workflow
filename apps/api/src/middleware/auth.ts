import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@printing-workflow/db';
import { env } from '../env.js';

/**
 * Authentication middleware for API routes
 * Supports multiple authentication methods:
 * 1. API Key (X-API-Key header)
 * 2. Session-based (from NextAuth - for web app)
 * 3. Internal service token (for webhooks)
 */

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId?: string;
  };
}

/**
 * Verify API key from database
 */
async function verifyApiKey(apiKey: string) {
  // TODO: Implement API key storage in database
  // For now, check against environment variable
  if (env.API_SECRET_KEY && apiKey === env.API_SECRET_KEY) {
    return {
      id: 'api-service',
      email: 'service@system.com',
      role: 'SYSTEM',
      companyId: undefined,
    };
  }
  return null;
}

/**
 * Verify internal service token (for webhooks)
 */
function verifyServiceToken(token: string): boolean {
  return env.WEBHOOK_SECRET && token === env.WEBHOOK_SECRET;
}

/**
 * Main authentication middleware
 */
export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  // 1. Check for API Key
  const apiKey = request.headers['x-api-key'] as string;
  if (apiKey) {
    const user = await verifyApiKey(apiKey);
    if (user) {
      request.user = user;
      return;
    }
  }

  // 2. Check for service token (for internal services)
  const serviceToken = request.headers['x-service-token'] as string;
  if (serviceToken && verifyServiceToken(serviceToken)) {
    request.user = {
      id: 'internal-service',
      email: 'internal@system.com',
      role: 'SYSTEM',
      companyId: undefined,
    };
    return;
  }

  // 3. Check for session cookie (NextAuth)
  // TODO: Implement session verification with NextAuth
  // For now, development mode allows unauthenticated requests
  if (env.NODE_ENV === 'development') {
    // In development, allow requests without auth but log warning
    request.log.warn('⚠️  Unauthenticated request (development mode)');
    request.user = {
      id: 'dev-user',
      email: 'admin@impactdirect.com',
      role: 'BROKER_ADMIN',
      companyId: 'impact-direct',
    };
    return;
  }

  // No valid authentication found
  reply.code(401).send({
    error: 'Unauthorized',
    message: 'Authentication required. Provide X-API-Key header or valid session.',
  });
}

/**
 * Optional authentication (doesn't block requests without auth)
 * Useful for endpoints that behave differently for authenticated users
 */
export async function optionalAuth(
  request: AuthenticatedRequest,
  _reply: FastifyReply
) {
  const apiKey = request.headers['x-api-key'] as string;
  if (apiKey) {
    const user = await verifyApiKey(apiKey);
    if (user) {
      request.user = user;
    }
  }
  // Don't block if no auth provided
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }
  };
}

/**
 * Company-based authorization
 * Ensures user can only access resources from their company
 */
export async function requireCompanyAccess(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  resourceCompanyId: string
) {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  // System users have access to everything
  if (request.user.role === 'SYSTEM') {
    return;
  }

  // BROKER_ADMIN and MANAGER have access to all companies
  if (['BROKER_ADMIN', 'MANAGER'].includes(request.user.role)) {
    return;
  }

  // Regular users can only access their own company's resources
  if (request.user.companyId !== resourceCompanyId) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'You can only access resources from your own company',
    });
  }
}

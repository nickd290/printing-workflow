import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@printing-workflow/db';
import { verifyPassword, generateJWT, verifyJWT } from '../lib/auth.js';

// Request schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/login
   * Login with email and password
   */
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          company: true,
        },
      });

      // Check if user exists
      if (!user) {
        return reply.status(401).send({
          error: 'Invalid email or password',
        });
      }

      // Check if user has a password (OAuth users might not)
      if (!user.password) {
        return reply.status(401).send({
          error: 'This account uses OAuth. Please use the OAuth login method.',
        });
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return reply.status(401).send({
          error: 'Invalid email or password',
        });
      }

      // Generate JWT token
      const token = generateJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Set httpOnly cookie
      reply.setCookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        path: '/',
      });

      // Return user data (without password)
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company?.name,
        },
        token, // Also send token in response for localStorage option
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user from JWT token
   */
  fastify.get('/me', async (request, reply) => {
    try {
      // Try to get token from cookie or Authorization header
      let token = request.cookies.auth_token;

      if (!token) {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        return reply.status(401).send({
          error: 'Not authenticated',
        });
      }

      // Verify token
      const payload = verifyJWT(token);

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          company: true,
        },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'User not found',
        });
      }

      // Return user data
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company?.name,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid or expired token') {
        return reply.status(401).send({
          error: 'Invalid or expired token',
        });
      }
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout (clear cookie)
   */
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('auth_token', {
      path: '/',
    });

    return reply.send({
      message: 'Logged out successfully',
    });
  });
};

export default authRoutes;

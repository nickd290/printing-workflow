/**
 * Zod Validation Middleware for Fastify
 *
 * Validates request bodies, query parameters, and route params
 * using Zod schemas from @printing-workflow/shared
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validate request body against Zod schema
 */
export function validateBody(schema: ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse and validate body
      request.body = schema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      throw error;
    }
  };
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery(schema: ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.query = schema.parse(request.query);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      throw error;
    }
  };
}

/**
 * Validate route parameters against Zod schema
 */
export function validateParams(schema: ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.params = schema.parse(request.params);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'Validation Error',
          message: 'Invalid route parameters',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      throw error;
    }
  };
}

/**
 * Combined validation (body + query + params)
 */
export function validate(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (schemas.body) {
        request.body = schemas.body.parse(request.body);
      }
      if (schemas.query) {
        request.query = schemas.query.parse(request.query);
      }
      if (schemas.params) {
        request.params = schemas.params.parse(request.params);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'Validation Error',
          message: 'Request validation failed',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            type: err.code,
          })),
        });
      }
      throw error;
    }
  };
}

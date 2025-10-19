/**
 * Integration tests for webhook routes
 * Tests authentication, request validation, and end-to-end webhook processing
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { webhookRoutes } from '../routes/webhooks.js';
import { env } from '../env.js';
import FormData from 'form-data';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
      fields: 20,
      parts: 25,
    },
  });

  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/webhooks/inbound-email - Authentication', () => {
  test('should reject request without webhook secret when WEBHOOK_SECRET is set', async () => {
    // Mock env to have WEBHOOK_SECRET
    const originalSecret = env.WEBHOOK_SECRET;
    (env as any).WEBHOOK_SECRET = 'test-secret-12345678901234567890';

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      error: expect.stringContaining('Unauthorized'),
    });

    // Restore
    (env as any).WEBHOOK_SECRET = originalSecret;
  });

  test('should accept request with valid webhook secret in query', async () => {
    const originalSecret = env.WEBHOOK_SECRET;
    (env as any).WEBHOOK_SECRET = 'test-secret-12345678901234567890';

    const form = new FormData();
    form.append('from', 'steve.gustafson@bgeltd.com');
    form.append('subject', 'JJSG Order');
    form.append('text', 'Email body');

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email?token=test-secret-12345678901234567890',
      headers: form.getHeaders(),
      payload: form,
    });

    // Should pass authentication (may fail on other validations)
    expect(response.statusCode).not.toBe(401);

    (env as any).WEBHOOK_SECRET = originalSecret;
  });

  test('should accept request with valid webhook secret in header', async () => {
    const originalSecret = env.WEBHOOK_SECRET;
    (env as any).WEBHOOK_SECRET = 'test-secret-12345678901234567890';

    const form = new FormData();
    form.append('from', 'steve.gustafson@bgeltd.com');
    form.append('subject', 'JJSG Order');
    form.append('text', 'Email body');

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: {
        ...form.getHeaders(),
        'x-webhook-secret': 'test-secret-12345678901234567890',
      },
      payload: form,
    });

    expect(response.statusCode).not.toBe(401);

    (env as any).WEBHOOK_SECRET = originalSecret;
  });

  test('should reject request with invalid webhook secret', async () => {
    const originalSecret = env.WEBHOOK_SECRET;
    (env as any).WEBHOOK_SECRET = 'test-secret-12345678901234567890';

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email?token=wrong-secret',
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    expect(response.statusCode).toBe(401);

    (env as any).WEBHOOK_SECRET = originalSecret;
  });
});

describe('POST /api/webhooks/inbound-email - Request Validation', () => {
  test('should reject request with no multipart data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: {
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: expect.stringContaining('email data'),
    });
  });

  test('should reject request missing "from" field', async () => {
    const form = new FormData();
    form.append('subject', 'JJSG Order');
    form.append('text', 'Email body');

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: form.getHeaders(),
      payload: form,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: expect.stringContaining('required email fields'),
    });
  });

  test('should reject request missing "subject" field', async () => {
    const form = new FormData();
    form.append('from', 'steve.gustafson@bgeltd.com');
    form.append('text', 'Email body');

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: form.getHeaders(),
      payload: form,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: expect.stringContaining('required email fields'),
    });
  });
});

describe('POST /api/webhooks/inbound-email - Email Processing', () => {
  test('should reject email from non-Bradford sender', async () => {
    const form = new FormData();
    form.append('from', 'attacker@evil.com');
    form.append('subject', 'JJSG Order');
    form.append('text', 'Fake email');

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: form.getHeaders(),
      payload: form,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      result: {
        action: 'ignored',
        reason: expect.stringContaining('Bradford'),
      },
    });
  });

  test('should reject email without customer code', async () => {
    const form = new FormData();
    form.append('from', 'steve.gustafson@bgeltd.com');
    form.append('subject', 'Random Email');
    form.append('text', 'No customer code');

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: form.getHeaders(),
      payload: form,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      result: {
        action: 'ignored',
        reason: expect.stringContaining('customer code'),
      },
    });
  });

  test('should reject email without PDF attachment', async () => {
    const form = new FormData();
    form.append('from', 'steve.gustafson@bgeltd.com');
    form.append('subject', 'JJSG Order 12345');
    form.append('text', 'Email with customer code but no PDF');

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: form.getHeaders(),
      payload: form,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      result: {
        action: 'ignored',
        reason: expect.stringContaining('PDF attachments'),
      },
    });
  });
});

describe('GET /api/webhooks/events - List Webhook Events', () => {
  test('should list webhook events', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/webhooks/events',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('events');
    expect(Array.isArray(response.json().events)).toBe(true);
  });

  test('should filter webhook events by source', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/webhooks/events?source=EMAIL',
    });

    expect(response.statusCode).toBe(200);
    const { events } = response.json();
    expect(Array.isArray(events)).toBe(true);

    // All events should be from EMAIL source
    events.forEach((event: any) => {
      expect(event.source).toBe('EMAIL');
    });
  });

  test('should filter webhook events by processed status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/webhooks/events?processed=true',
    });

    expect(response.statusCode).toBe(200);
    const { events } = response.json();

    events.forEach((event: any) => {
      expect(event.processed).toBe(true);
    });
  });
});

describe('File Size Limits', () => {
  test('should reject files larger than 10MB', async () => {
    const form = new FormData();
    form.append('from', 'steve.gustafson@bgeltd.com');
    form.append('subject', 'JJSG Order');

    // Create a buffer larger than 10MB
    const largeFile = Buffer.alloc(11 * 1024 * 1024, 'a');
    form.append('attachment1', largeFile, {
      filename: 'large.pdf',
      contentType: 'application/pdf',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/inbound-email',
      headers: form.getHeaders(),
      payload: form,
    });

    // Should fail due to file size limit
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});

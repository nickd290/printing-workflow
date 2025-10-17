import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string(),
    REDIS_URL: z.string().url().optional(),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().default('6379'),

    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_PUBLIC_URL: z.string().url().optional(),

    SENDGRID_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email(),
    EMAIL_FROM_NAME: z.string().default('IDP Production'),
    EMAIL_REDIRECT_TO: z.string().email().optional(), // Redirect all emails to this address (for testing)

    API_PORT: z.string().default('3001'),
    API_URL: z.string().url().default('http://localhost:3001'),

    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32),

    OPENAI_API_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

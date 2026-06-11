import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(12),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim())),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_WEBHOOK_PUBLIC_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  AI_ML_SERVICE_URL: z.string().url().optional(),

  REDIS_URL: z.string().url().optional(),

  ENCRYPTION_KEY: z.string().refine((val) => {
    try {
      return Buffer.from(val, 'base64').length === 32;
    } catch {
      return false;
    }
  }, { message: "ENCRYPTION_KEY must be a valid base64 string exactly 32 bytes long." }),
});

function parseConfig() {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}


export const config = parseConfig();

export type Config = typeof config;

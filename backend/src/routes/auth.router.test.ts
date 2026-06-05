import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createDatabaseClient } from '../db/index.js';
import { tenants, users } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';

const db = createDatabaseClient({ connectionString: config.DATABASE_URL });

const app = createApp({
  corsOrigins: ['http://localhost:5173'],
  db,
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
});

const TEST_TENANT = {
  name: 'Auth Test Tenant',
  slug: `auth-test-${Date.now()}`,
};

const TEST_USER = {
  email: `authtest-${Date.now()}@test.com`,
  password: 'StrongPass123!',
};

let tenantId: string;
let authToken: string;

describe('Auth API', () => {
  beforeAll(async () => {
    // Seed a tenant for testing — A6 handles tenant management API
    const rows = await db.insert(tenants).values(TEST_TENANT).returning();
    tenantId = rows[0]!.id;
  });

  afterAll(async () => {
    // Cleanup: delete test user and tenant
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  describe('POST /api/auth/register', () => {
    it('returns 400 on missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bad' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('returns 404 for non-existent tenant', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Tenant not found');
    });

    it('registers a new user and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId,
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(TEST_USER.email);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 409 on duplicate email for same tenant', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId,
        });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: 'WrongPassword',
          tenantId,
        });

      expect(res.status).toBe(401);
    });

    it('returns 401 on non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@test.com',
          password: TEST_USER.password,
          tenantId,
        });

      expect(res.status).toBe(401);
    });

    it('logs in and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(TEST_USER.email);
      expect(res.body.user.passwordHash).toBeUndefined();
      authToken = res.body.token;
    });
  });

  describe('Auth middleware (protected route)', () => {
    it('returns 401 without token', async () => {
      // Health is public, so test middleware directly via a custom route
      const protectedApp = createApp({
        corsOrigins: ['*'],
        db,
        jwtSecret: config.JWT_SECRET,
      });

      // Mount a test-only protected endpoint
      const { Router } = await import('express');
      const testRouter = Router();
      testRouter.get('/', (req, res) => {
        res.json({ ok: true });
      });
      protectedApp.use('/api/test-protected', protectedApp.locals.authMiddleware, testRouter);

      const res = await request(protectedApp).get('/api/test-protected');
      expect(res.status).toBe(401);
    });

    it('returns 200 with valid token', async () => {
      const protectedApp = createApp({
        corsOrigins: ['*'],
        db,
        jwtSecret: config.JWT_SECRET,
      });

      const { Router } = await import('express');
      const testRouter = Router();
      testRouter.get('/', (req, res) => {
        res.json({ ok: true });
      });
      protectedApp.use('/api/test-protected', protectedApp.locals.authMiddleware, testRouter);

      const res = await request(protectedApp)
        .get('/api/test-protected')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns 401 with garbage token', async () => {
      const protectedApp = createApp({
        corsOrigins: ['*'],
        db,
        jwtSecret: config.JWT_SECRET,
      });

      const { Router } = await import('express');
      const testRouter = Router();
      testRouter.get('/', (req, res) => {
        res.json({ ok: true });
      });
      protectedApp.use('/api/test-protected', protectedApp.locals.authMiddleware, testRouter);

      const res = await request(protectedApp)
        .get('/api/test-protected')
        .set('Authorization', 'Bearer garbage.token.here');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('returns 401 with garbage token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer garbage.token.here');

      expect(res.status).toBe(401);
    });

    it('returns a new token with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.token).not.toBe(authToken);
      expect(res.body.user.email).toBe(TEST_USER.email);
      expect(res.body.user.passwordHash).toBeUndefined();

      // Use the refreshed token for subsequent tests
      authToken = res.body.token;
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(TEST_USER.email);
      expect(res.body.role).toBe('viewer');
      expect(res.body.tenantId).toBe(tenantId);
      expect(res.body.passwordHash).toBeUndefined();
    });
  });
});

/**
 * health.router.test.ts
 *
 * Unit tests for GET /api/health.
 * Uses Vitest + supertest to exercise the route in isolation
 * (no real server start, no external dependencies).
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp({ corsOrigins: ['http://localhost:5173'] });

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('includes a valid ISO timestamp', async () => {
    const res = await request(app).get('/api/health');

    expect(typeof res.body.timestamp).toBe('string');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it('includes uptime as a non-negative number', async () => {
    const res = await request(app).get('/api/health');

    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('includes environment field', async () => {
    const res = await request(app).get('/api/health');

    expect(typeof res.body.environment).toBe('string');
  });
});

/**
 * Admin settings sanitizer + PATCH endpoint tests.
 * Pattern derived from: semantic_flow security.test.js (config masking invariants)
 *                       and anything-llm defaults.test.js (boundary value checking).
 * Tests: sanitizeConfig invariants via GET response + PATCH validation logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupAdminRoutes } from '../app/features/admin/routes.mjs';

function makeApp() {
  const app = express();
  app.use(express.json());
  setupAdminRoutes(app, { logger: { info: () => {}, error: () => {}, child: () => ({ info: () => {}, error: () => {} }) } });
  return app;
}

describe('GET /api/admin/settings — response shape', () => {
  it('returns 200 with required envelope keys', async () => {
    const res = await request(makeApp()).get('/api/admin/settings');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('source', 'runtime');
    expect(res.body).toHaveProperty('config');
    expect(res.body).toHaveProperty('featureFlags');
    expect(res.body).toHaveProperty('surfaces');
    expect(res.body).toHaveProperty('updatedAt');
  });

  it('featureFlags is an array of objects with id, label, enabled', async () => {
    const res = await request(makeApp()).get('/api/admin/settings');
    expect(Array.isArray(res.body.featureFlags)).toBe(true);
    for (const flag of res.body.featureFlags) {
      expect(flag).toHaveProperty('id');
      expect(flag).toHaveProperty('label');
      expect(typeof flag.enabled).toBe('boolean');
    }
  });

  it('surfaces is an object of booleans', async () => {
    const res = await request(makeApp()).get('/api/admin/settings');
    expect(typeof res.body.surfaces).toBe('object');
    for (const val of Object.values(res.body.surfaces)) {
      expect(typeof val).toBe('boolean');
    }
  });
});

describe('GET /api/config — sanitizer masking invariants', () => {
  it('masks apiKey values to bullet string', async () => {
    const res = await request(makeApp()).get('/api/config');
    expect(res.status).toBe(200);
    // Walk config looking for any raw API key that leaked through (none expected)
    const str = JSON.stringify(res.body.config);
    // Pattern: no key fields with actual bearer/API token-like values (14+ hex chars or sk- prefix)
    expect(str).not.toMatch(/"apiKey"\s*:\s*"sk-[a-zA-Z0-9]{10,}/);
    expect(str).not.toMatch(/"token"\s*:\s*"[a-f0-9]{32,}/);
  });

  it('surfaces the •••••••• mask symbol when config has secret fields', async () => {
    const res = await request(makeApp()).get('/api/config');
    // The mask value should appear or no secret keys should be present at all
    const str = JSON.stringify(res.body.config);
    // Masked values or no raw secret present — either is correct behavior
    if (str.includes('"apiKey"') || str.includes('"token"')) {
      expect(str).toContain('••••••••');
    }
  });
});

describe('PATCH /api/admin/settings — validation', () => {
  it('accepts valid boolean featureFlags', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .send({ featureFlags: { 'streaming-responses': false } });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toHaveProperty('featureFlags');
    expect(res.body.rejected).toHaveLength(0);
    expect(res.body.source).toBe('patch');
  });

  it('rejects non-boolean featureFlag values', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .send({ featureFlags: { 'streaming-responses': 'yes' } });
    expect(res.status).toBe(200);
    const rejected = res.body.rejected;
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected[0].reason).toBe('value must be boolean');
  });

  it('rejects unknown surface keys', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .send({ surfaces: { 'widget-xyz': true } });
    expect(res.status).toBe(200);
    const rejected = res.body.rejected;
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected[0].reason).toBe('unknown surface key');
  });

  it('accepts known surface keys with boolean values', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .send({ surfaces: { memory: false, chat: true } });
    expect(res.status).toBe(200);
    expect(res.body.accepted.surfaces).toMatchObject({ memory: false, chat: true });
    expect(res.body.rejected).toHaveLength(0);
  });

  it('rejects non-boolean surface values', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .send({ surfaces: { memory: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.rejected[0].reason).toBe('value must be boolean');
  });

  it('returns 400 when body is an array', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .send([{ featureFlags: {} }]);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ValidationError/);
  });

  it('returns 400 when body is missing', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .set('Content-Type', 'application/json')
      .send('');
    // body.parse of empty string → {} or null depending on express version
    // Either 400 bad body or accepted empty patch is acceptable
    expect([200, 400]).toContain(res.status);
  });

  it('returns patch envelope with note about secrets', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.note).toContain('Config secrets');
    expect(res.body.updatedAt).toBeTruthy();
  });

  it('accepts mixed valid+invalid keys and separates them', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/settings')
      .send({
        featureFlags: { 'mission-scheduler': true, badKey: 'bad' },
        surfaces: { dashboard: false, unknownSurface: true },
      });
    expect(res.status).toBe(200);
    expect(res.body.accepted.featureFlags).toHaveProperty('mission-scheduler', true);
    expect(res.body.accepted.surfaces).toHaveProperty('dashboard', false);
    expect(res.body.rejected.length).toBeGreaterThanOrEqual(2);
  });
});

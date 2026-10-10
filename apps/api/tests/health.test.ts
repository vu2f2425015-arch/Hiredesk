import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Health and Middleware API Suite', () => {
  const app = createApp();

  it('GET /health returns 200 with structured status payload', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.service).toBe('hiredesk-api');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.meta.requestId).toBeDefined();
  });

  it('GET /api/health returns 200 and preserves client x-request-id header', async () => {
    const customRequestId = 'test-request-id-12345';
    const res = await request(app).get('/api/health').set('x-request-id', customRequestId);
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customRequestId);
    expect(res.body.meta.requestId).toBe(customRequestId);
  });

  it('GET /unknown-route returns standard 404 error envelope', async () => {
    const res = await request(app).get('/api/not-found-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.meta.requestId).toBeDefined();
  });
});

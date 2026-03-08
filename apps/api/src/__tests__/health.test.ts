import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import healthRoutes from '../routes/health.js';

describe('Health endpoint', () => {
  const app = new Hono();
  app.route('/health', healthRoutes);

  it('GET /health returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(body.timestamp).toBeDefined();
  });
});

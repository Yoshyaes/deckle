import { Hono } from 'hono';
import { getUsageStats } from '../services/usage.js';

const app = new Hono();

app.get('/', async (c) => {
  const user = c.get('user');
  const stats = await getUsageStats(user.id, user.plan);
  return c.json(stats);
});

export default app;

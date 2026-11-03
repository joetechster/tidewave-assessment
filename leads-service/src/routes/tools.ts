import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as db from '../db';
import { requireTools } from '../auth';

export const toolsRouter = Router();

// POST /__tools/reset (Bearer tw_tools_c0ffee)
toolsRouter.post('/reset', requireTools, async (req: Request, res: Response) => {
  try {
    // 1. Truncate leads schema tables
    await db.query(`
      TRUNCATE TABLE leads.lead_activity, leads.leads, leads.event_outbox RESTART IDENTITY CASCADE
    `);

    // 2. Re-apply seed data from 002_seed.sql
    const seedPath = path.resolve(__dirname, '../../migrations/002_seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf-8');
      await db.query(seedSql);
    }

    res.json({ ok: true, message: 'Leads schema reset and re-seeded successfully' });
  } catch (err) {
    console.error('Error during tools reset:', err);
    res.status(500).json({ error: 'Failed to reset schema', details: (err as Error).message });
  }
});

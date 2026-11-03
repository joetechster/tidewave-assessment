import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as db from '../db';
import { calculateScore, determineStatus } from '../scoring';
import { sendLeadCreatedEvent } from '../events';
import { requireStaff, requireStaffOrAutomation } from '../auth';

export const leadsRouter = Router();

const createLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().nullable(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  city: z.string().min(1, 'City is required'),
  experienceYears: z.union([z.number(), z.string()]).optional().default(0),
  hoursPerWeek: z.union([z.number(), z.string()]).optional().default(0),
  source: z.string().optional().nullable(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent must be accepted' }),
  }),
});

// POST /leads (public)
leadsRouter.post('/', async (req: Request, res: Response) => {
  const parseResult = createLeadSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errors = parseResult.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(422).json({ errors });
    return;
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    city,
    experienceYears,
    hoursPerWeek,
    source,
    consent,
  } = parseResult.data;

  try {
    // Duplicate check:
    // Applications where previous consent was withdrawn are not duplicates
    const dupQuery = `
      SELECT id, status FROM leads.leads
      WHERE (email = $1 OR phone = $2) AND consent_withdrawn = false
      ORDER BY created_at ASC
      LIMIT 1
    `;
    const dupRes = await db.query(dupQuery, [email, phone]);
    const isDuplicate = dupRes.rows.length > 0;

    const score = calculateScore({ experienceYears, hoursPerWeek, city });
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (isDuplicate) {
      const duplicateOf = dupRes.rows[0].id;
      const insertQuery = `
        INSERT INTO leads.leads (
          id, first_name, last_name, email, phone, city,
          experience_years, hours_per_week, source, consent,
          consent_withdrawn, score, status, duplicate_of
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, 'duplicate', $12)
        RETURNING id, status, duplicate_of AS "duplicateOf"
      `;
      const inserted = await db.query(insertQuery, [
        leadId,
        firstName,
        lastName || null,
        email,
        phone,
        city,
        experienceYears,
        hoursPerWeek,
        source || null,
        consent,
        score,
        duplicateOf,
      ]);

      await db.query(
        `INSERT INTO leads.lead_activity (id, lead_id, type, detail, actor)
         VALUES ($1, $2, 'duplicate_detected', $3, 'system')`,
        [
          `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          leadId,
          JSON.stringify({ duplicateOf }),
        ]
      );

      res.status(201).json({
        id: inserted.rows[0].id,
        status: 'duplicate',
        duplicateOf,
      });
      return;
    }

    const status = determineStatus(score);

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sendLeadCreatedEvent({
      id: eventId,
      type: 'lead.created',
      createdAt: new Date().toISOString(),
      data: {
        leadId,
        status,
        email,
        firstName,
      },
    });

    const insertQuery = `
      INSERT INTO leads.leads (
        id, first_name, last_name, email, phone, city,
        experience_years, hours_per_week, source, consent,
        consent_withdrawn, score, status, duplicate_of
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $12, NULL)
      RETURNING id, status, duplicate_of AS "duplicateOf"
    `;

    const inserted = await db.query(insertQuery, [
      leadId,
      firstName,
      lastName || null,
      email,
      phone,
      city,
      experienceYears,
      hoursPerWeek,
      source || null,
      consent,
      score,
      status,
    ]);

    await db.query(
      `INSERT INTO leads.lead_activity (id, lead_id, type, detail, actor)
       VALUES ($1, $2, 'application_created', $3, 'system')`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        leadId,
        JSON.stringify({ source, score, status }),
      ]
    );

    res.status(201).json({
      id: inserted.rows[0].id,
      status: inserted.rows[0].status,
      duplicateOf: null,
    });
  } catch (err) {
    console.error('Error creating lead:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leads (staff tokens)
leadsRouter.get('/', requireStaff, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize as string, 10) || 20));
    const search = ((req.query.search as string) || '').trim();
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params: any[] = [];
    if (search) {
      whereClause = `
        WHERE first_name ILIKE $1
           OR last_name ILIKE $1
           OR email ILIKE $1
           OR phone ILIKE $1
           OR city ILIKE $1
      `;
      params.push(`%${search}%`);
    }

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM leads.leads ${whereClause}`,
      params
    );
    const total = countRes.rows[0].total;

    const dataParams = [...params, pageSize, offset];
    const dataRes = await db.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName",
              email, phone, city, experience_years AS "experienceYears",
              hours_per_week AS "hoursPerWeek", source, consent, score,
              status, duplicate_of AS "duplicateOf",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM leads.leads
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    res.json({
      items: dataRes.rows,
      page,
      pageSize,
      total,
    });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leads/:id (staff or automation)
leadsRouter.get('/:id', requireStaffOrAutomation, async (req: Request, res: Response) => {
  try {
    const leadRes = await db.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName",
              email, phone, city, experience_years AS "experienceYears",
              hours_per_week AS "hoursPerWeek", source, consent, score,
              status, duplicate_of AS "duplicateOf",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM leads.leads
       WHERE id = $1`,
      [req.params.id]
    );

    if (leadRes.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json(leadRes.rows[0]);
  } catch (err) {
    console.error('Error fetching lead:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /leads/:id/status (staff admin only)
leadsRouter.patch('/:id/status', requireStaff, async (req: Request, res: Response) => {
  const { status } = req.body;

  const allowedStatuses = ['screening_invite', 'needs_review', 'not_now', 'duplicate', 'active'];
  if (!status || !allowedStatuses.includes(status)) {
    res.status(422).json({
      error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
    });
    return;
  }

  try {
    const existing = await db.query(`SELECT id, status FROM leads.leads WHERE id = $1`, [
      req.params.id,
    ]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const oldStatus = existing.rows[0].status;

    const updated = await db.query(
      `UPDATE leads.leads
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, first_name AS "firstName", last_name AS "lastName",
                 email, phone, city, experience_years AS "experienceYears",
                 hours_per_week AS "hoursPerWeek", source, consent, score,
                 status, duplicate_of AS "duplicateOf",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [status, req.params.id]
    );

    await db.query(
      `INSERT INTO leads.lead_activity (id, lead_id, type, detail, actor)
       VALUES ($1, $2, 'status_changed', $3, 'system')`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        req.params.id,
        JSON.stringify({ from: oldStatus, to: status }),
      ]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error updating lead status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /leads/:id/activity (automation or staff)
leadsRouter.post('/:id/activity', requireStaffOrAutomation, async (req: Request, res: Response) => {
  const { type, detail } = req.body;
  if (!type) {
    res.status(422).json({ error: 'Activity type is required' });
    return;
  }

  try {
    const leadCheck = await db.query(`SELECT id FROM leads.leads WHERE id = $1`, [req.params.id]);
    if (leadCheck.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO leads.lead_activity (id, lead_id, type, detail, actor)
       VALUES ($1, $2, $3, $4, 'system')`,
      [activityId, req.params.id, type, JSON.stringify(detail || {})]
    );

    res.status(201).json({ id: activityId });
  } catch (err) {
    console.error('Error inserting activity:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leads/:id/activity (staff or automation)
leadsRouter.get('/:id/activity', requireStaffOrAutomation, async (req: Request, res: Response) => {
  try {
    const actRes = await db.query(
      `SELECT id, type, detail, actor, created_at AS "createdAt"
       FROM leads.lead_activity
       WHERE lead_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json(actRes.rows);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

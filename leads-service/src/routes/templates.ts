import { Router, Request, Response } from 'express';
import { listTemplates, renderTemplate } from '../templates';
import { requireStaffOrAutomation } from '../auth';

export const templatesRouter = Router();

// GET /templates (staff or automation)
templatesRouter.get('/', requireStaffOrAutomation, (req: Request, res: Response) => {
  try {
    const items = listTemplates();
    res.json(items);
  } catch (err) {
    console.error('Error listing templates:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /templates/:key/render (staff or automation)
templatesRouter.post('/:key/render', requireStaffOrAutomation, (req: Request, res: Response) => {
  const { key } = req.params;
  const { variables, test } = req.body || {};

  try {
    const result = renderTemplate(key, variables, Boolean(test));
    if (!result) {
      res.status(404).json({ error: `Template '${key}' not found` });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('Error rendering template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

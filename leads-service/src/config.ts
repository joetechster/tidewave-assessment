import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '8081', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgres://leads_app:leads_pw@localhost:7432/tidewave',
  staffAdminToken: process.env.STAFF_ADMIN_TOKEN || 'tw_staff_admin_5f2c9a',
  staffViewerToken: process.env.STAFF_VIEWER_TOKEN || 'tw_staff_viewer_81d4e0',
  automationToken: process.env.AUTOMATION_TOKEN || 'tw_automation_3b7e11',
  toolsToken: process.env.TOOLS_TOKEN || 'tw_tools_c0ffee',
  eventsSigningSecret: process.env.EVENTS_SIGNING_SECRET || 'whsec_tidewave_demo_2f9a',
  n8nLeadsEventsUrl: process.env.N8N_LEADS_EVENTS_URL || 'http://n8n:5678/webhook/street-team-lead',
  templatesDir: process.env.TEMPLATES_DIR || path.resolve(__dirname, '../../../templates'),
};

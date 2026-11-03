import express from 'express';
import { authenticate } from './auth';
import { leadsRouter } from './routes/leads';
import { templatesRouter } from './routes/templates';
import { toolsRouter } from './routes/tools';

export const app = express();

app.use(express.json());
app.use(authenticate);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Mount routers
app.use('/leads', leadsRouter);
app.use('/templates', templatesRouter);
app.use('/__tools', toolsRouter);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

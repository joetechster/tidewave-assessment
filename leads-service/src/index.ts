import { app } from './app';
import { config } from './config';
import { runMigrations } from './migrations';

async function startServer() {
  try {
    console.log('[Server] Connecting to database and running migrations...');
    await runMigrations();
    console.log('[Server] Migrations finished successfully.');
  } catch (err) {
    console.error('[Server] Warning: Failed to run migrations on startup:', (err as Error).message);
    console.log('[Server] Proceeding with server start...');
  }

  app.listen(config.port, () => {
    console.log(`[Server] Tidewave Leads Service running on port ${config.port}`);
  });
}

startServer();

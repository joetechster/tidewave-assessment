import fs from 'fs';
import path from 'path';
import * as db from './db';

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[Migrations] Directory not found, skipping');
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`[Migrations] Found ${files.length} migration file(s)`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    try {
      console.log(`[Migrations] Running ${file}...`);
      await db.query(sql);
      console.log(`[Migrations] Completed ${file}`);
    } catch (err) {
      console.error(`[Migrations] Failed to run migration ${file}:`, err);
      throw err;
    }
  }
}

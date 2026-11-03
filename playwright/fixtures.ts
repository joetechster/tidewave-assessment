import { Page } from '@playwright/test';

/**
 * Reset all services back to seed data.
 */
export async function resetAll() {
  const headers = { Authorization: 'Bearer tw_tools_c0ffee' };
  const [resEngine, resLeads] = await Promise.all([
    fetch('http://localhost:7080/__tools/reset', { method: 'POST', headers }).catch((err) => ({
      ok: false,
      status: 0,
      statusText: String(err),
    })),
    fetch('http://localhost:7081/__tools/reset', { method: 'POST', headers }).catch((err) => ({
      ok: false,
      status: 0,
      statusText: String(err),
    })),
  ]);

  if (!resEngine.ok || !resLeads.ok) {
    throw new Error(
      `resetAll failed: engine=${'status' in resEngine ? resEngine.status : 'error'}, leads=${'status' in resLeads ? resLeads.status : 'error'}`
    );
  }
}

/**
 * Log in to the public website as a specific persona.
 */
export async function loginAs(page: Page, persona: string) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(persona);
  await page.getByLabel('Password').fill('listen123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/me');
}

/**
 * Log in to the staff ops console.
 */
export async function opsLogin(page: Page, role: 'Admin' | 'Viewer') {
  await page.goto('http://localhost:7300/login');
  await page.getByRole('button', { name: `Sign in as ${role}` }).click();
  await page.waitForURL('**/leads');
}

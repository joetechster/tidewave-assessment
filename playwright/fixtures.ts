import { Page, expect } from '@playwright/test';
import crypto from 'crypto';

export const ENGINE_URL = 'http://localhost:7080';
export const LEADS_URL = 'http://localhost:7081';

// Demo tokens from docs/SETUP.md (local test environment only).
export const auth = {
  admin: { Authorization: 'Bearer tw_staff_admin_5f2c9a' },
  viewer: { Authorization: 'Bearer tw_staff_viewer_81d4e0' },
  automation: { Authorization: 'Bearer tw_automation_3b7e11' },
};

/**
 * Unique, test-domain identity so repeated runs never collide as duplicates
 * and never address a real mailbox.
 */
export function uniquePerson(tag: string) {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    firstName: `PW${tag}`,
    email: `pw.${tag.toLowerCase()}.${id}@mail.test`,
    phone: `+234${id.slice(-10)}`,
  };
}

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

  // The engine reset restores n8nEventsUrl to n8n's editor-only /webhook-test/ path, which answers 404
  // to the engine, so no event would reach the published workflow (F-01). Point it back after each reset.
  const settings = await fetch(`${ENGINE_URL}/api/staff/settings`, {
    method: 'PUT',
    headers: { ...auth.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ n8nEventsUrl: N8N_EVENTS_URL }),
  });
  if (!settings.ok) throw new Error(`resetAll could not set n8nEventsUrl: ${settings.status}`);
}

/** Published solace-events webhook, as the engine reaches it inside Docker. */
export const N8N_EVENTS_URL = 'http://n8n:5678/webhook/solace-events';

/** From the campaign checkout, quote the Listener level and land on the FakePay page. Returns the FakePay ref. */
export async function startListenerBacking(page: Page) {
  await page.goto('/checkout?campaign=harmattan-sessions');
  await page.getByRole('button', { name: /Become a Listener/ }).click();
  await page.getByRole('checkbox', { name: /backing is voluntary/ }).check();
  await page.getByRole('button', { name: 'Review backing' }).click();

  await expect(page.getByRole('heading', { name: 'Review your backing' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Fee \(2\.5%\)/ })).toContainText('₦100.00');
  await expect(page.getByRole('row', { name: /Total to pay/ })).toContainText('₦2,100.00');
  await page.getByRole('button', { name: 'Pay with FakePay' }).click();

  await page.waitForURL(/localhost:7090\/pay\/fp_/);
  return new URL(page.url()).pathname.split('/').pop()!;
}

export async function payWithCard(page: Page, card: string) {
  await page.getByLabel('Card number').fill(card);
  await page.getByLabel('Expiry').fill('12/30');
  await page.getByLabel('CVC').fill('123');
  await page.getByRole('button', { name: /^Pay / }).click();
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

export const MAILPIT_URL = 'http://localhost:7025';
export const N8N_URL = 'http://localhost:7678';
const TOOLS = { Authorization: 'Bearer tw_tools_c0ffee', 'Content-Type': 'application/json' };
// Demo signing secret from docs/SETUP.md; used to send events to n8n exactly as the engine/leads service would.
const EVENTS_SIGNING_SECRET = 'whsec_tidewave_demo_2f9a';

/** Subjects of the Mailpit messages matching a Mailpit search query (e.g. `to:x@mail.test`). */
export async function mailSubjects(query: string): Promise<string[]> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}&limit=100`);
  const body = (await res.json()) as { messages: { Subject: string }[] };
  return body.messages.map((m) => m.Subject);
}

export async function deleteMail(query: string) {
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`, { method: 'DELETE' });
}

/** Make Mailpit refuse recipients with 451 for the given share of messages (0 turns it off). */
export async function mailpitChaos(probability: number) {
  const res = await fetch(`${MAILPIT_URL}/api/v1/chaos`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Recipient: { ErrorCode: 451, Probability: probability } }),
  });
  if (!res.ok) throw new Error(`mailpit chaos failed: ${res.status}`);
}

/** Make the next `count` engine automation API calls fail with `status`. */
export async function engineChaos(status: number, count: number) {
  const res = await fetch(`${ENGINE_URL}/__tools/chaos`, {
    method: 'POST',
    headers: TOOLS,
    body: JSON.stringify({ target: 'automation-api', status, count }),
  });
  if (!res.ok) throw new Error(`engine chaos failed: ${res.status}`);
}

/** Ask the engine to send one of its events to n8n again. */
export async function redeliver(eventId: string) {
  const res = await fetch(`${ENGINE_URL}/__tools/redeliver`, { method: 'POST', headers: TOOLS, body: JSON.stringify({ eventId }) });
  if (!res.ok) throw new Error(`redeliver failed: ${res.status}`);
}

/** Engine event deliveries (newest last) from the signed evidence export. */
export async function engineEvents(): Promise<{ id: string; type: string; attempts: number; lastStatus: string }[]> {
  const res = await fetch(`${ENGINE_URL}/__tools/evidence`, { headers: TOOLS });
  return ((await res.json()) as { payload: { events: [] } }).payload.events;
}

/** POST an event to an n8n webhook with a valid X-Tidewave-Signature (or a bad one when `secret` is given). */
export async function sendSignedEvent(path: string, event: { id: string; type: string; data: unknown }, secret = EVENTS_SIGNING_SECRET) {
  const raw = JSON.stringify({ createdAt: new Date().toISOString(), sequence: 1, ...event });
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const res = await fetch(`${N8N_URL}/webhook/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tidewave-Event-Id': event.id, 'X-Tidewave-Signature': `t=${t},v1=${v1}` },
    body: raw,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

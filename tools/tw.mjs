#!/usr/bin/env node
// Tidewave assessment helper. Usage: node tools/tw.mjs <command> [args]
//   setup-check            check that every service is up
//   reset                  reset engine and leads data to the seed
//   clock <minutes>        move the engine clock forward
//   chaos <status> <count> make the next <count> automation API calls fail with <status>
//   redeliver <eventId>    send an engine event to n8n again
//   export-n8n             save your n8n workflows to n8n/workflows/ and executions to evidence/
//   evidence               save the signed engine log and the Mailpit message list to evidence/
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const TOOLS = { Authorization: 'Bearer tw_tools_c0ffee', 'Content-Type': 'application/json' };
const URLS = {
  engine: 'http://localhost:7080', fakepay: 'http://localhost:7090', leads: 'http://localhost:7081',
  n8n: 'http://localhost:7678', mailpit: 'http://localhost:7025', ops: 'http://localhost:7300',
};
const N8N_LOGIN = { emailOrLdapLoginId: 'assessor@tidewave.test', password: 'Tidewave!2026' };

async function http(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch {}
    return { status: res.status, body, headers: res.headers };
  } catch (e) {
    return { status: 0, body: String(e.cause?.code || e.message) };
  }
}

function out(p, data) {
  const f = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
  console.log('saved', p);
}

async function n8nSession() {
  const res = await fetch(URLS.n8n + '/rest/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(N8N_LOGIN) });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!res.ok || !cookie) throw new Error('n8n login failed (' + res.status + ')');
  return { Cookie: cookie };
}

const commands = {
  async 'setup-check'() {
    const checks = [
      ['Node version 22-24', async () => { const m = +process.versions.node.split('.')[0]; return m >= 22 && m <= 24 ? 'ok' : 'found ' + process.versions.node; }],
      ['Public website  ' + URLS.engine, async () => (await http(URLS.engine + '/')).status === 200 ? 'ok' : 'not reachable'],
      ['FakePay         ' + URLS.fakepay, async () => (await http(URLS.fakepay + '/dashboard')).status === 200 ? 'ok' : 'not reachable'],
      ['Leads service   ' + URLS.leads, async () => (await http(URLS.leads + '/health')).status === 200 ? 'ok' : 'not reachable'],
      ['Mailpit         ' + URLS.mailpit, async () => (await http(URLS.mailpit + '/api/v1/info')).status === 200 ? 'ok' : 'not reachable'],
      ['n8n             ' + URLS.n8n, async () => (await http(URLS.n8n + '/healthz')).status === 200 ? 'ok' : 'not reachable (first start takes about 3 minutes)'],
      ['n8n workflows published', async () => {
        const r = await http(URLS.n8n + '/webhook/staff-test-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return r.status && r.status !== 404 ? 'ok' : 'webhooks not registered yet';
      }],
      ['Engine database (via API)', async () => (await http(URLS.engine + '/api/staff/payments', { headers: { Authorization: 'Bearer tw_staff_viewer_81d4e0' } })).status === 200 ? 'ok' : 'engine API error'],
      ['Ops console     ' + URLS.ops + ' (start it with npm run dev)', async () => (await http(URLS.ops + '/login')).status === 200 ? 'ok' : 'not running yet (optional for this check)'],
    ];
    let bad = 0;
    for (const [name, fn] of checks) {
      const r = await fn();
      if (r !== 'ok' && !name.startsWith('Ops console')) bad++;
      console.log((r === 'ok' ? 'PASS ' : 'FAIL ') + name + (r === 'ok' ? '' : '  -> ' + r));
    }
    console.log(bad ? `\n${bad} check(s) failed. If setup takes more than 20 minutes, stop and contact us.` : '\nAll services are up. You can start.');
    process.exitCode = bad ? 1 : 0;
  },
  async reset() {
    for (const u of [URLS.engine, URLS.leads]) {
      const r = await http(u + '/__tools/reset', { method: 'POST', headers: TOOLS });
      console.log(u, r.status === 200 ? 'reset ok' : 'reset failed ' + r.status);
    }
  },
  async clock(minutes) {
    const r = await http(URLS.engine + '/__tools/clock', { method: 'POST', headers: TOOLS, body: JSON.stringify({ advanceMinutes: +minutes || 0 }) });
    console.log(r.status, r.body);
  },
  async chaos(status = '503', count = '2') {
    const r = await http(URLS.engine + '/__tools/chaos', { method: 'POST', headers: TOOLS, body: JSON.stringify({ target: 'automation-api', status: +status, count: +count }) });
    console.log(r.status, r.body);
  },
  async redeliver(eventId) {
    const r = await http(URLS.engine + '/__tools/redeliver', { method: 'POST', headers: TOOLS, body: JSON.stringify({ eventId }) });
    console.log(r.status, r.body);
  },
  async 'export-n8n'() {
    const h = await n8nSession();
    const list = await http(URLS.n8n + '/rest/workflows', { headers: h });
    const items = list.body?.data ?? [];
    for (const w of items) {
      const full = await http(URLS.n8n + '/rest/workflows/' + w.id, { headers: h });
      const wf = full.body?.data ?? full.body;
      const keep = { id: wf.id, name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings, active: false };
      const known = { wf_street_team_lead: 'street-team-lead', wf_solace_events: 'solace-events', wf_staff_test_run: 'staff-test-run' };
      const file = known[wf.id] || 'extra-' + (wf.name || wf.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out(`n8n/workflows/${file}.json`, keep);
    }
    const ex = await http(URLS.n8n + '/rest/executions?limit=100', { headers: h });
    out('evidence/n8n-executions.json', ex.body);
  },
  async evidence() {
    const e = await http(URLS.engine + '/__tools/evidence', { headers: TOOLS });
    if (e.status !== 200) { console.log('engine evidence failed', e.status); process.exitCode = 1; return; }
    out('evidence/engine-log.signed.json', e.body);
    const m = await http(URLS.mailpit + '/api/v1/messages?limit=500');
    out('evidence/mailpit-messages.json', m.body);
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log('Commands: ' + Object.keys(commands).join(', '));
  process.exitCode = 1;
} else {
  await commands[cmd](...args);
}

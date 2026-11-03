import { NextRequest, NextResponse } from 'next/server';
import { getStaffRole, getStaffToken } from '@/lib/serverAuth';
import { Template } from '@/lib/types';

export async function POST(request: NextRequest) {
  const role = await getStaffRole();
  const token = await getStaffToken();
  if (!role || !token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { templateKey?: unknown; variables?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  const leadsUrl = process.env.LEADS_URL || 'http://localhost:7081';
  const n8nUrl =
    process.env.N8N_TEST_RUN_URL || 'http://localhost:7678/webhook/staff-test-run';

  // Only approved templates may be test-sent, and only their declared variables are forwarded.
  let template: Template | undefined;
  try {
    const res = await fetch(`${leadsUrl}/templates`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error();
    const templates: Template[] = await res.json();
    template = templates.find((t) => t.key === body.templateKey);
  } catch {
    return NextResponse.json(
      { error: 'Could not load templates from the leads service. Try again shortly.' },
      { status: 502 }
    );
  }

  if (!template || template.status !== 'approved') {
    return NextResponse.json(
      { error: 'Choose an approved template. Draft templates cannot be test-sent.' },
      { status: 400 }
    );
  }

  const input =
    body.variables && typeof body.variables === 'object'
      ? (body.variables as Record<string, unknown>)
      : {};
  const variables: Record<string, string> = {};
  const missing: string[] = [];
  for (const v of template.variables) {
    const value = typeof input[v.name] === 'string' ? (input[v.name] as string).trim() : '';
    if (value) variables[v.name] = value;
    else if (v.required) missing.push(v.label);
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Please fill in: ${missing.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey: template.key,
        variables,
        requestedBy: role === 'Admin' ? 'staff.admin' : 'staff.viewer',
      }),
    });

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `The test run was not sent (automation returned ${res.status}).` },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to dispatch test run to n8n webhook' },
      { status: 502 }
    );
  }
}

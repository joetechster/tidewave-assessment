import { NextRequest, NextResponse } from 'next/server';
import { getStaffRole } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
  const role = await getStaffRole();
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const n8nUrl =
    process.env.N8N_TEST_RUN_URL || 'http://localhost:7678/webhook/staff-test-run';

  try {
    const body = await request.json();
    const payload = {
      templateKey: body.templateKey,
      variables: body.variables || {},
      requestedBy: role === 'Admin' ? 'staff.admin' : 'staff.viewer',
    };

    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Failed to dispatch test run to n8n webhook' },
      { status: 502 }
    );
  }
}

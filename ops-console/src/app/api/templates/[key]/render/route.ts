import { NextRequest, NextResponse } from 'next/server';
import { getStaffToken } from '@/lib/serverAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const token = await getStaffToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { key } = await params;
  const leadsUrl = process.env.LEADS_URL || 'http://localhost:7081';

  try {
    const body = await request.json();
    const res = await fetch(`${leadsUrl}/templates/${key}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Failed to communicate with leads service' },
      { status: 502 }
    );
  }
}

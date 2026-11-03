import { NextRequest, NextResponse } from 'next/server';
import { getStaffToken } from '@/lib/serverAuth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getStaffToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const leadsUrl = process.env.LEADS_URL || 'http://localhost:7081';

  try {
    const res = await fetch(`${leadsUrl}/leads/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
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

import { NextRequest, NextResponse } from 'next/server';
import { getStaffToken } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  const token = await getStaffToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const participantId = searchParams.get('participantId');
  const status = searchParams.get('status');

  const engineUrl = process.env.ENGINE_URL || 'http://localhost:7080';
  const targetUrl = new URL('/api/staff/payments', engineUrl);
  if (participantId) targetUrl.searchParams.set('participantId', participantId);
  if (status) targetUrl.searchParams.set('status', status);

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Failed to communicate with engine service' },
      { status: 502 }
    );
  }
}

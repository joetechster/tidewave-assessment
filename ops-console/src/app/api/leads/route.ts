import { NextRequest, NextResponse } from 'next/server';
import { getStaffToken } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  const token = await getStaffToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('pageSize') || '20';
  const search = searchParams.get('search') || '';

  const leadsUrl = process.env.LEADS_URL || 'http://localhost:7081';
  const targetUrl = new URL('/leads', leadsUrl);
  targetUrl.searchParams.set('page', page);
  targetUrl.searchParams.set('pageSize', pageSize);
  if (search) {
    targetUrl.searchParams.set('search', search);
  }

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
      { error: 'Failed to communicate with leads service' },
      { status: 502 }
    );
  }
}

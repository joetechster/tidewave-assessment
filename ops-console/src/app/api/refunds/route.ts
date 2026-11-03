import { NextRequest, NextResponse } from 'next/server';
import { getStaffRole } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
  const role = await getStaffRole();
  if (role !== 'Admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required to process refunds' },
      { status: 403 }
    );
  }

  const token = process.env.STAFF_ADMIN_TOKEN || 'tw_staff_admin_5f2c9a';
  const engineUrl = process.env.ENGINE_URL || 'http://localhost:7080';

  try {
    const body = await request.json();
    const res = await fetch(`${engineUrl}/api/staff/refunds`, {
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
      { error: 'Failed to communicate with engine service' },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role } = body;

    if (role !== 'Admin' && role !== 'Viewer') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, role });
    response.cookies.set('staff_role', role, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

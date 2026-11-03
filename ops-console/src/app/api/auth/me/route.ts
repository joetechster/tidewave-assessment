import { NextResponse } from 'next/server';
import { getStaffRole } from '@/lib/serverAuth';

export async function GET() {
  const role = await getStaffRole();
  return NextResponse.json({ role });
}

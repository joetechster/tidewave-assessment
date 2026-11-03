import { cookies } from 'next/headers';

export async function getStaffRole(): Promise<'Admin' | 'Viewer' | null> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get('staff_role');
  if (roleCookie?.value === 'Admin' || roleCookie?.value === 'Viewer') {
    return roleCookie.value;
  }
  return null;
}

export async function getStaffToken(): Promise<string | null> {
  const role = await getStaffRole();
  if (role === 'Admin') {
    return process.env.STAFF_ADMIN_TOKEN || 'tw_staff_admin_5f2c9a';
  }
  if (role === 'Viewer') {
    return process.env.STAFF_VIEWER_TOKEN || 'tw_staff_viewer_81d4e0';
  }
  return null;
}

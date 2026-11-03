import { redirect } from 'next/navigation';
import { getStaffRole } from '@/lib/serverAuth';

export default async function HomePage() {
  const role = await getStaffRole();
  if (!role) {
    redirect('/login');
  }
  redirect('/leads');
}

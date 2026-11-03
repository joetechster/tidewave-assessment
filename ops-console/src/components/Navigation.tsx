'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Navigation() {
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // The layout (and this nav) survives client-side navigation, so re-read the
  // session on route change; otherwise it keeps the signed-out state after login.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setRole(data.role))
      .catch(() => setRole(null));
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setRole(null);
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link href="/leads" style={{ color: '#ffffff', textDecoration: 'none' }}>
          Tidewave Ops Console
        </Link>
      </div>
      <div className="navbar-links">
        {role && (
          <>
            <Link href="/leads">Leads</Link>
            <Link href="/payments">Payments</Link>
            <Link href="/messages/test">Test Messages</Link>
            <span className="navbar-role" aria-label="Role indicator">
              Role: {role}
            </span>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              Sign out
            </button>
          </>
        )}
        {!role && (
          <Link href="/login" className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (role: 'Admin' | 'Viewer') => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        throw new Error('Failed to sign in');
      }

      router.push('/leads');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto' }}>
      <div className="card">
        <h1 className="page-title" style={{ marginBottom: '1rem', textAlign: 'center' }}>
          Staff Sign In
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
          Choose your operational role to access the console.
        </p>

        {error && <div className="alert-box alert-error">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleLogin('Admin')}
            disabled={loading}
          >
            Sign in as Admin
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleLogin('Viewer')}
            disabled={loading}
          >
            Sign in as Viewer
          </button>
        </div>
      </div>
    </div>
  );
}

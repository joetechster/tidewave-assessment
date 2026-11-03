'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lead, Activity } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    Promise.all([
      fetch(`/api/leads/${id}`).then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return null;
          }
          throw new Error('Failed to load lead details');
        }
        return res.json();
      }),
      fetch(`/api/leads/${id}/activity`).then((res) => {
        if (!res.ok) return [];
        return res.json();
      }),
    ])
      .then(([leadData, activityData]) => {
        if (!ignore && leadData) {
          setLead(leadData);
          setActivity(Array.isArray(activityData) ? activityData : []);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error loading lead');
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [id, router]);

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading lead details...</p>;
  }

  if (error || !lead) {
    return (
      <div className="card">
        <div className="alert-box alert-error">{error || 'Lead not found'}</div>
        <Link href="/leads" className="btn btn-secondary">
          &larr; Back to Leads
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/leads" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>
            &larr; Back to Leads
          </Link>
          <h1 className="page-title" style={{ marginTop: '0.5rem' }}>
            {lead.firstName} {lead.lastName}
          </h1>
        </div>
        <div>
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Email</span>
          <strong>{lead.email}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Phone</span>
          <strong>{lead.phone}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>City</span>
          <strong>{lead.city}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Score</span>
          <strong>{lead.score}</strong>
        </div>
        {lead.experienceYears !== undefined && (
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Experience</span>
            <strong>{lead.experienceYears} years</strong>
          </div>
        )}
        {lead.hoursPerWeek !== undefined && (
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Availability</span>
            <strong>{lead.hoursPerWeek} hrs/week</strong>
          </div>
        )}
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Created</span>
          <strong>{new Date(lead.createdAt).toLocaleString()}</strong>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Activity Log</h2>
        {activity.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No activity recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Detail</th>
                <th>Actor</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code>{item.type}</code>
                  </td>
                  <td>
                    <code>{typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail)}</code>
                  </td>
                  <td>{item.actor}</td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

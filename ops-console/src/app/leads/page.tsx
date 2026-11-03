'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Lead } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetch(`/api/leads?page=${page}&pageSize=${pageSize}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return null;
          }
          throw new Error('Failed to load leads');
        }
        return res.json();
      })
      .then((data) => {
        if (!ignore && data) {
          setLeads(data.items || []);
          setTotal(data.total || 0);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error loading leads');
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [page, pageSize, router]);

  // Client-side search filtering over loaded rows
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.firstName?.toLowerCase().includes(q) ||
        lead.lastName?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.city?.toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Street Team Leads</h1>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input
            type="text"
            className="input-text"
            placeholder="Search leads by name, email, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading leads...</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="clickable"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                    >
                      <td>
                        <strong>{lead.firstName} {lead.lastName}</strong>
                      </td>
                      <td>{lead.email}</td>
                      <td>{lead.city}</td>
                      <td>{lead.score}</td>
                      <td>
                        <StatusBadge status={lead.status} />
                      </td>
                      <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="pagination">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '1rem' }}>
                Page {page} of {totalPages} ({total} total leads)
              </span>
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

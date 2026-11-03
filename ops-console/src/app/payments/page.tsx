'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Payment } from '@/lib/types';
import { formatMoney } from '@/lib/formatMoney';

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchPayments = () => {
    setLoading(true);
    fetch('/api/payments')
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return null;
          }
          throw new Error('Failed to load payments');
        }
        return res.json();
      })
      .then((data) => {
        if (data) setPayments(data);
      })
      .catch((err: unknown) => {
        setNotification({
          type: 'error',
          message: err instanceof Error ? err.message : 'Error loading payments',
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((d) => setRole(d.role));
    fetchPayments();
  }, [router]);

  const handleRefund = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to refund this payment?')) return;
    setActionLoading(paymentId);
    setNotification(null);

    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refund payment');
      }

      setNotification({ type: 'success', message: `Refund processed for payment ${paymentId}` });
      fetchPayments();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Refund failed',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Backing Payments</h1>
      </div>

      <div className="card">
        {notification && (
          <div className={`alert-box alert-${notification.type}`}>{notification.message}</div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading payments...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Campaign</th>
                <th>Amount</th>
                <th>Fee</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No payments found.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <code>{payment.participantId}</code>
                    </td>
                    <td>{payment.campaignSlug}</td>
                    <td>
                      <strong>{formatMoney(payment.amountMinor, payment.currency)}</strong>
                    </td>
                    <td>{formatMoney(payment.feeMinor, payment.currency)}</td>
                    <td>
                      <span className={`badge ${payment.status === 'succeeded' ? 'badge-invite' : 'badge-notnow'}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td>{new Date(payment.createdAt).toLocaleString()}</td>
                    <td>
                      {role === 'Admin' ? (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          disabled={actionLoading === payment.id || payment.status !== 'succeeded'}
                          onClick={() => handleRefund(payment.id)}
                        >
                          {actionLoading === payment.id ? 'Refunding...' : 'Refund'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Admin only
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

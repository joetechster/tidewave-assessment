import React from 'react';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  screening_invite: { label: 'Active rep', className: 'badge-invite' },
  needs_review: { label: 'Needs Review', className: 'badge-review' },
  not_now: { label: 'Not Now', className: 'badge-notnow' },
  duplicate: { label: 'Duplicate', className: 'badge-duplicate' },
};

export default function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] || { label: status, className: 'badge-default' };
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}

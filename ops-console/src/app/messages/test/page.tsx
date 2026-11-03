'use client';

import React, { useEffect, useState } from 'react';
import { Template } from '@/lib/types';

export default function MessageTestPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [rawVariables, setRawVariables] = useState<string>('{\n  "firstName": "Ada"\n}');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Dropdown lists all templates returned from the endpoint
          setTemplates(data);
          if (data.length > 0) {
            setSelectedKey(data[0].key);
          }
        }
      })
      .catch(() => {
        setNotification({ type: 'error', message: 'Failed to load templates' });
      });
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setLoading(true);

    try {
      let parsedVariables = {};
      try {
        parsedVariables = JSON.parse(rawVariables);
      } catch {
        throw new Error('Variables must be valid JSON');
      }

      const res = await fetch('/api/messages/test-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: selectedKey,
          variables: parsedVariables,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to dispatch test run');
      }

      setNotification({
        type: 'success',
        message: 'Test run dispatched successfully to staff inbox (staff-test@tidewave.test).',
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error sending test run',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Test Email Template</h1>
      </div>

      <div className="card">
        {notification && (
          <div className={`alert-box alert-${notification.type}`}>{notification.message}</div>
        )}

        <form onSubmit={handleSendTest}>
          <div className="form-group">
            <label htmlFor="template-select">Template</label>
            <select
              id="template-select"
              className="select-input"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              {templates.map((tpl) => (
                <option key={tpl.key} value={tpl.key}>
                  {tpl.name} ({tpl.key})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="raw-variables">Template Variables (JSON)</label>
            <textarea
              id="raw-variables"
              className="textarea-input"
              rows={6}
              value={rawVariables}
              onChange={(e) => setRawVariables(e.target.value)}
            />
          </div>

          <div className="alert-box alert-note" style={{ marginBottom: '1.5rem' }}>
            Preview not built yet.
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || !selectedKey}>
            {loading ? 'Sending...' : 'Send TEST run'}
          </button>
        </form>
      </div>
    </div>
  );
}

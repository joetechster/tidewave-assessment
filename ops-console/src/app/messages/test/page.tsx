'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Template } from '@/lib/types';

const STAFF_TEST_RECIPIENT = 'staff-test@tidewave.test';

type Notification = { type: 'success' | 'error'; message: string };
type Preview = { subject: string; html: string };

export default function MessageTestPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  const selected = templates.find((t) => t.key === selectedKey);

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;
        // Draft templates are never offered for sending.
        const approved = (data as Template[]).filter((t) => t.status === 'approved');
        setTemplates(approved);
        if (approved.length > 0) setSelectedKey(approved[0].key);
      })
      .catch(() => setNotification({ type: 'error', message: 'Could not load templates. Refresh the page to try again.' }))
      .finally(() => setLoadingTemplates(false));
  }, [router]);

  // Live preview: re-render (debounced) whenever the template or a field changes.
  useEffect(() => {
    if (!selectedKey) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/templates/${encodeURIComponent(selectedKey)}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: values, test: true }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Preview failed');
          setPreview({ subject: data.subject, html: data.html });
          setPreviewError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setPreviewError(err instanceof Error ? err.message : 'Preview failed');
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedKey, values]);

  const handleTemplateChange = (key: string) => {
    setSelectedKey(key);
    setValues({});
    setMissing([]);
    setPreview(null);
    setNotification(null);
  };

  const handleValueChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setMissing((prev) => prev.filter((n) => n !== name));
  };

  const fillWithExamples = () => {
    if (!selected) return;
    setValues(Object.fromEntries(selected.variables.map((v) => [v.name, v.example])));
    setMissing([]);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || sending) return;
    setNotification(null);

    const empty = selected.variables
      .filter((v) => v.required && !(values[v.name] || '').trim())
      .map((v) => v.name);
    if (empty.length > 0) {
      setMissing(empty);
      const labels = selected.variables.filter((v) => empty.includes(v.name)).map((v) => v.label);
      setNotification({ type: 'error', message: `Not sent. Please fill in: ${labels.join(', ')}.` });
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/messages/test-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: selected.key, variables: values }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) {
        throw new Error(result.error || 'The test run could not be sent.');
      }
      setNotification({
        type: 'success',
        message: `Sent. "${result.subject || selected.subject}" was delivered to ${result.to || STAFF_TEST_RECIPIENT}.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: `Not sent. ${err instanceof Error ? err.message : 'The test run could not be sent.'}`,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Test Email Template</h1>
      </div>

      <p className="page-intro">
        Choose an approved template, fill in the fields and check the preview. Test runs are only ever sent to{' '}
        <strong>{STAFF_TEST_RECIPIENT}</strong>, never to customers.
      </p>

      {notification && (
        <div
          className={`alert-box alert-${notification.type}`}
          role={notification.type === 'error' ? 'alert' : 'status'}
          data-testid="test-run-notification"
        >
          {notification.message}
        </div>
      )}

      <div className="test-layout">
        <div className="card">
          {loadingTemplates ? (
            <p className="muted">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="muted">No approved templates are available.</p>
          ) : (
            <form onSubmit={handleSendTest} noValidate>
              <div className="form-group">
                <label htmlFor="template-select">Template</label>
                <select
                  id="template-select"
                  className="select-input"
                  value={selectedKey}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  {templates.map((tpl) => (
                    <option key={tpl.key} value={tpl.key}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
                {selected && <p className="field-hint">Subject: {selected.subject}</p>}
              </div>

              {selected?.variables.map((v) => {
                const id = `var-${v.name}`;
                const invalid = missing.includes(v.name);
                return (
                  <div className="form-group" key={`${selected.key}-${v.name}`}>
                    <label htmlFor={id}>
                      {v.label}
                      {v.required ? (
                        <span className="required-mark" aria-hidden="true"> *</span>
                      ) : (
                        <span className="optional-mark"> (optional)</span>
                      )}
                    </label>
                    <input
                      id={id}
                      name={v.name}
                      className={`input-text${invalid ? ' input-invalid' : ''}`}
                      type="text"
                      placeholder={`e.g. ${v.example}`}
                      value={values[v.name] || ''}
                      required={v.required}
                      aria-required={v.required}
                      aria-invalid={invalid}
                      aria-describedby={invalid ? `${id}-error` : undefined}
                      onChange={(e) => handleValueChange(v.name, e.target.value)}
                    />
                    {invalid && (
                      <p id={`${id}-error`} className="field-error">
                        {v.label} is required.
                      </p>
                    )}
                  </div>
                );
              })}

              <p className="field-hint">* required</p>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={sending || !selected}>
                  {sending ? 'Sending...' : 'Send TEST run'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={fillWithExamples} disabled={sending}>
                  Fill with examples
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <div className="preview-header">
            <h2 className="section-title">Preview</h2>
            <div className="toggle-group" role="group" aria-label="Preview width">
              <button
                type="button"
                className={`btn btn-secondary${previewWidth === 'desktop' ? ' is-active' : ''}`}
                aria-pressed={previewWidth === 'desktop'}
                onClick={() => setPreviewWidth('desktop')}
              >
                Desktop
              </button>
              <button
                type="button"
                className={`btn btn-secondary${previewWidth === 'mobile' ? ' is-active' : ''}`}
                aria-pressed={previewWidth === 'mobile'}
                onClick={() => setPreviewWidth('mobile')}
              >
                Mobile (375px)
              </button>
            </div>
          </div>

          {previewError ? (
            <div className="alert-box alert-error" role="alert">
              Preview unavailable: {previewError}
            </div>
          ) : preview ? (
            <>
              <p className="field-hint">
                Subject: <strong data-testid="preview-subject">{preview.subject}</strong>
              </p>
              <iframe
                title="Email preview"
                className="preview-frame"
                sandbox=""
                srcDoc={preview.html}
                style={{ width: previewWidth === 'mobile' ? 375 : '100%' }}
              />
            </>
          ) : (
            <p className="muted">{selectedKey ? 'Rendering preview...' : 'Choose a template to see a preview.'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';

export interface ConfirmRequest {
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Optional text input (e.g. a reason), with quick picks. */
  input?: { label: string; placeholder?: string; presets?: string[]; initial?: string };
  resolve: (value: string | null) => void;
}

/** Accessible confirm dialog with big buttons (phones / tablets). Resolves with the input text, '' or null if cancelled. */
export default function ConfirmDialog({ req, onClose }: { req: ConfirmRequest | null; onClose: () => void }) {
  const [text, setText] = useState(req?.input?.initial ?? '');
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!req) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { req.resolve(null); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [req, onClose]);

  if (!req) return null;
  const done = (v: string | null) => { req.resolve(v); onClose(); };
  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      // above the site's floating chat widget
      style={{ background: 'rgba(0,0,0,0.45)', zIndex: 100000 }} onMouseDown={(e) => { if (e.target === e.currentTarget) done(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dss-confirm-title" className="card border-0 shadow-lg w-100" style={{ maxWidth: 440 }}>
        <div className="card-body p-4">
          <h5 id="dss-confirm-title" className="fw-bold mb-2">{req.title}</h5>
          {req.body && <div className="text-muted mb-3">{req.body}</div>}
          {req.input && (
            <div className="mb-3">
              <label className="form-label small fw-semibold" htmlFor="dss-confirm-input">{req.input.label}</label>
              <input id="dss-confirm-input" className="form-control form-control-lg" value={text} maxLength={120}
                placeholder={req.input.placeholder} onChange={(e) => setText(e.target.value)} />
              {req.input.presets && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {req.input.presets.map((p) => (
                    <button key={p} type="button" className={`btn btn-sm ${text === p ? '' : 'dss-outline'}`} onClick={() => setText(p)}>{p}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-lg dss-outline" style={{ '--dss-c': '#495057' } as React.CSSProperties} onClick={() => done(null)}>Cancel</button>
            <button ref={confirmRef} type="button" className={`btn btn-lg ${req.danger ? 'dss-solid-danger' : ''}`}
              onClick={() => done(text)}>{req.confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { StaffSnapshot } from '@/lib/queue/server';
import { lookupPatient } from '@/app/compounder/actions';
import { walkInImpact, PRIORITY_TEXT } from '@/lib/queue/display';
import { tealBtn } from './Panels';

interface Found { id: string; full_name: string; uhid: string; gender: string | null }

/** DSS-65: Module 4 walk-in lookup, plus the impact on others before the compounder confirms. */
export default function WalkInPanel({ snap, busy, onAdd }: {
  snap: StaffSnapshot; busy: boolean;
  onAdd: (p: { patientId: string; visitType: 'new' | 'follow_up'; level: 0 | 1 | 2; reason: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Found | null>(null);
  const [visitType, setVisitType] = useState<'new' | 'follow_up'>('new');
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  const impact = walkInImpact(snap, level, visitType);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true); setErr(null); setPicked(null);
    const r = await lookupPatient(query);
    setSearching(false);
    if (!r.success) setErr(r.error ?? 'Search failed');
    setFound((r.patients ?? []) as Found[]);
  };
  const confirm = async () => {
    if (!picked) return;
    const ok = await onAdd({ patientId: picked.id, visitType, level, reason: level ? PRIORITY_TEXT[level] : '' });
    if (ok) { setOpen(false); setQuery(''); setFound(null); setPicked(null); setLevel(0); }
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-lg w-100 mb-3 dss-outline" onClick={() => setOpen(true)} disabled={snap.session.state === 'ended'}>
        <i className="bi bi-person-plus me-2" />Add walk-in
      </button>
    );
  }
  return (
    <div role="region" aria-label="Add walk-in" className="card border-0 shadow-sm rounded-3 mb-3">
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="fw-bold m-0">Add walk-in</h6>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setOpen(false)} />
        </div>
        <div className="input-group input-group-lg mb-2">
          <input className="form-control" placeholder="UHID or mobile" aria-label="UHID or mobile" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} />
          <button type="button" className="btn btn-outline-secondary" onClick={search} disabled={searching}>{searching ? 'Searching…' : 'Find'}</button>
        </div>
        {err && <div className="text-danger small mb-2">{err}</div>}
        {found && found.length === 0 && (
          <div className="small text-muted mb-2">No patient found. <Link href="/compounder/walk-in">Register a new patient</Link></div>
        )}
        {found && found.length > 0 && (
          <div className="list-group mb-2">
            {found.map((p) => (
              <button key={p.id} type="button" onClick={() => setPicked(p)}
                className={`list-group-item list-group-item-action ${picked?.id === p.id ? 'active' : ''}`}>
                {p.full_name} <span className="small opacity-75">· {p.uhid}</span>
              </button>
            ))}
          </div>
        )}
        {picked && (
          <>
            <div className="d-flex flex-wrap gap-3 mb-2">
              <div className="btn-group" role="group" aria-label="Visit type">
                {(['new', 'follow_up'] as const).map((v) => (
                  <button key={v} type="button" className={`btn ${visitType === v ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setVisitType(v)}>
                    {v === 'new' ? 'New' : 'Follow-up'}
                  </button>
                ))}
              </div>
              <div className="btn-group" role="group" aria-label="Priority">
                {([0, 1, 2] as const).map((l) => (
                  <button key={l} type="button" className={`btn ${level === l ? (l === 2 ? 'btn-danger' : l === 1 ? 'btn-warning' : 'btn-secondary') : 'btn-outline-secondary'}`} onClick={() => setLevel(l)}>
                    {PRIORITY_TEXT[l]}
                  </button>
                ))}
              </div>
            </div>
            <div className="alert alert-info py-2 small mb-2" role="status">
              {impact.patients > 0
                ? <>Adds about <strong>{impact.minutes} min</strong> for the last <strong>{impact.patients}</strong> patient(s).</>
                : <>Nobody waiting is pushed back.</>}
            </div>
            <button type="button" className="btn btn-lg w-100" style={tealBtn} disabled={busy} onClick={confirm}>
              Confirm walk-in for {picked.full_name}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

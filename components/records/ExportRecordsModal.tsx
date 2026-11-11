'use client';

import React, { useState } from 'react';
import { getExportBundle } from '@/lib/records/export';
import { assembleExportZip } from '@/lib/records/exportZip';

type PatientOption = { id: string; full_name: string; uhid?: string };

const GROUPS = [
    { key: 'prescriptions', label: 'Prescriptions', types: ['prescription'] },
    { key: 'reports', label: 'Test reports', types: ['test_report'] },
    { key: 'other', label: 'Other documents (imaging, discharge summaries, receipts, other)', types: ['imaging', 'discharge_summary', 'invoice', 'other'] },
] as const;

type Phase = { kind: 'idle' } | { kind: 'working'; label: string; pct: number } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

async function fetchBytes(url: string): Promise<Uint8Array> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}

export default function ExportRecordsModal({ isOpen, onClose, patients, defaultPatientId }: {
    isOpen: boolean;
    onClose: () => void;
    patients: PatientOption[];
    defaultPatientId?: string;
}) {
    const [patientId, setPatientId] = useState(defaultPatientId || (patients.length === 1 ? patients[0].id : ''));
    const [groups, setGroups] = useState<Record<string, boolean>>({ prescriptions: true, reports: true, other: true });
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [includeSummary, setIncludeSummary] = useState(true);
    const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

    // The parent remounts this modal (key) when it opens, so defaults are applied fresh each time.
    if (!isOpen) return null;

    const busy = phase.kind === 'working';
    const selected = GROUPS.filter(g => groups[g.key]);

    const handleExport = async () => {
        if (!patientId) return setPhase({ kind: 'error', message: 'Please choose a profile.' });
        if (!selected.length) return setPhase({ kind: 'error', message: 'Please choose at least one document type.' });
        if (from && to && from > to) return setPhase({ kind: 'error', message: 'The start date is after the end date.' });

        setPhase({ kind: 'working', label: 'Collecting documents…', pct: 5 });
        const types = selected.length === GROUPS.length ? [] : selected.flatMap(g => [...g.types]);
        const res = await getExportBundle(patientId, { types, from: from || null, to: to || null, includeSummary }).catch(() => null);
        if (!res?.bundle) return setPhase({ kind: 'error', message: res?.error || 'Could not prepare the export. Please try again.' });

        const { bundle } = res;
        if (!bundle.documents.length && !includeSummary) {
            return setPhase({ kind: 'error', message: 'No documents match these filters.' });
        }

        try {
            const total = bundle.documents.length;
            const { zip, fileName, included, missing } = await assembleExportZip(bundle, fetchBytes, (done, all) =>
                setPhase({ kind: 'working', label: `Downloading ${done} of ${all} documents…`, pct: 10 + Math.round((done / all) * 85) }),
            );
            setPhase({ kind: 'working', label: 'Creating ZIP file…', pct: 98 });

            const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);

            setPhase({
                kind: 'done',
                message: `${fileName} downloaded with ${included} of ${total} document${total === 1 ? '' : 's'}` +
                    (includeSummary ? ' and a health summary.' : '.') +
                    (missing.length ? ` ${missing.length} could not be downloaded; they are listed in README.txt.` : ''),
            });
        } catch {
            setPhase({ kind: 'error', message: 'Something went wrong while creating the ZIP file. Please try again.' });
        }
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} role="dialog" aria-modal="true" aria-labelledby="export-title">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 rounded-4 shadow">
                    <div className="modal-header border-bottom-0 pb-0">
                        <h5 id="export-title" className="modal-title fw-bold text-dark"><i className="bi bi-file-earmark-zip me-2" style={{ color: '#0D7D72' }}></i>Export Reports</h5>
                        <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={busy}></button>
                    </div>
                    <div className="modal-body py-4">
                        <p className="text-muted small">Download all reports of one person as a ZIP file to share with another hospital or keep for yourself.</p>

                        <label htmlFor="export-profile" className="form-label fw-medium">Profile</label>
                        <select id="export-profile" className="form-select mb-3" value={patientId} onChange={e => setPatientId(e.target.value)} disabled={busy}>
                            <option value="">-- Choose Profile --</option>
                            {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}{p.uhid ? ` (${p.uhid})` : ''}</option>)}
                        </select>

                        <fieldset className="mb-3" disabled={busy}>
                            <legend className="form-label fw-medium fs-6">Include</legend>
                            {GROUPS.map(g => (
                                <div key={g.key} className="form-check">
                                    <input className="form-check-input" type="checkbox" id={`export-${g.key}`} checked={!!groups[g.key]}
                                        onChange={e => setGroups(s => ({ ...s, [g.key]: e.target.checked }))} />
                                    <label className="form-check-label" htmlFor={`export-${g.key}`}>{g.label}</label>
                                </div>
                            ))}
                        </fieldset>

                        <div className="row g-2 mb-3">
                            <div className="col-6">
                                <label htmlFor="export-from" className="form-label fw-medium small">From (optional)</label>
                                <input id="export-from" type="date" className="form-control form-control-sm" value={from} onChange={e => setFrom(e.target.value)} disabled={busy} />
                            </div>
                            <div className="col-6">
                                <label htmlFor="export-to" className="form-label fw-medium small">To (optional)</label>
                                <input id="export-to" type="date" className="form-control form-control-sm" value={to} onChange={e => setTo(e.target.value)} disabled={busy} />
                            </div>
                        </div>

                        <div className="form-check mb-1">
                            <input className="form-check-input" type="checkbox" id="export-summary" checked={includeSummary} onChange={e => setIncludeSummary(e.target.checked)} disabled={busy} />
                            <label className="form-check-label" htmlFor="export-summary">Add health summary (medicines, conditions, test results)</label>
                        </div>

                        {phase.kind === 'working' && (
                            <div className="mt-4" aria-live="polite">
                                <div className="small text-muted mb-1">{phase.label}</div>
                                <div className="progress" style={{ height: 8 }} role="progressbar" aria-valuenow={phase.pct} aria-valuemin={0} aria-valuemax={100}>
                                    <div className="progress-bar" style={{ width: `${phase.pct}%`, backgroundColor: '#0D7D72' }}></div>
                                </div>
                            </div>
                        )}
                        {phase.kind === 'done' && <div className="alert alert-success small mt-4 mb-0" role="status"><i className="bi bi-check-circle me-1"></i>{phase.message}</div>}
                        {phase.kind === 'error' && <div className="alert alert-danger small mt-4 mb-0" role="alert">{phase.message}</div>}
                    </div>
                    <div className="modal-footer border-top-0">
                        <button type="button" className="btn btn-light rounded-pill" onClick={onClose} disabled={busy}>
                            {phase.kind === 'done' ? 'Close' : 'Cancel'}
                        </button>
                        <button type="button" className="btn text-white px-4 rounded-pill" style={{ backgroundColor: '#0D7D72' }} onClick={handleExport} disabled={busy}>
                            <i className="bi bi-download me-1"></i>{busy ? 'Exporting…' : phase.kind === 'done' ? 'Export again' : 'Export ZIP'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

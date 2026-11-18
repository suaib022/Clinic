'use client';

import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import type { HealthData, LabResult, Medication } from '@/lib/extraction/healthData';

const ACCENT = '#1B2978';

const fmtDate = (d: string | null) => {
    if (!d) return '—';
    try { return format(parseISO(d), 'd MMM yyyy'); } catch { return d; }
};

const FLAG_STYLE: Record<string, string> = {
    high: 'bg-danger-subtle text-danger-emphasis border border-danger-subtle',
    critical: 'bg-danger text-white',
    low: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    abnormal: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    normal: 'bg-success-subtle text-success-emphasis border border-success-subtle',
};

function FlagBadge({ flag }: { flag: string | null }) {
    if (!flag) return null;
    return <span className={`badge rounded-pill text-capitalize ${FLAG_STYLE[flag] || 'bg-secondary'}`} style={{ fontSize: '11px' }}>{flag}</span>;
}

/** Tiny trend line; shaded band = reference range of the latest reading. */
function Sparkline({ points, refLow, refHigh }: { points: { v: number; flag: string | null }[]; refLow: number | null; refHigh: number | null }) {
    const w = 140, h = 36, pad = 4;
    const values = points.map(p => p.v);
    const lo = Math.min(...values, refLow ?? Infinity), hi = Math.max(...values, refHigh ?? -Infinity);
    const span = hi - lo || 1;
    const x = (i: number) => pad + (points.length === 1 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (points.length - 1));
    const y = (v: number) => h - pad - ((v - lo) / span) * (h - 2 * pad);
    return (
        <svg width={w} height={h} role="img" aria-label="trend">
            {refLow !== null && refHigh !== null && (
                <rect x={0} width={w} y={y(refHigh)} height={Math.max(1, y(refLow) - y(refHigh))} fill="#d1fae5" />
            )}
            {points.length > 1 && (
                <polyline fill="none" stroke={ACCENT} strokeWidth={1.5} points={points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} />
            )}
            {points.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p.v)} r={2.5}
                    fill={p.flag === 'high' || p.flag === 'critical' ? '#dc3545' : p.flag === 'low' ? '#fd7e14' : ACCENT} />
            ))}
        </svg>
    );
}

type Trend = { key: string; name: string; readings: LabResult[]; latest: LabResult };

export default function HealthProfile({ data, onViewSource }: { data: HealthData; onViewSource: (recordId: string) => void }) {
    const { medications, notes, labs, insights } = data;

    const conditions = useMemo(() => {
        const seen = new Map<string, { content: string; type: string; date: string | null }>();
        for (const n of notes) {
            if (n.note_type !== 'diagnosis' && n.note_type !== 'allergy') continue;
            const key = `${n.note_type}:${n.content.toLowerCase()}`;
            if (!seen.has(key)) seen.set(key, { content: n.content, type: n.note_type, date: n.noted_on });
        }
        return [...seen.values()];
    }, [notes]);

    // Medications are sorted newest first; the first record_id is the latest prescription.
    const latestRx = useMemo(() => {
        const recordId = medications[0]?.record_id;
        if (!recordId) return null;
        return {
            recordId,
            date: medications[0].prescribed_on,
            meds: medications.filter(m => m.record_id === recordId),
            notes: notes.filter(n => n.record_id === recordId && n.note_type !== 'diagnosis' && n.note_type !== 'allergy'),
        };
    }, [medications, notes]);

    const olderMeds = useMemo(() => {
        const groups = new Map<string, Medication[]>();
        for (const m of medications) {
            if (m.record_id === latestRx?.recordId) continue;
            groups.set(m.record_id, [...(groups.get(m.record_id) || []), m]);
        }
        return [...groups.entries()];
    }, [medications, latestRx]);

    const trends = useMemo(() => {
        const groups = new Map<string, LabResult[]>();
        for (const l of labs) {
            const key = l.analyte.trim().toLowerCase();
            groups.set(key, [...(groups.get(key) || []), l]);
        }
        const list: Trend[] = [...groups.entries()].map(([key, readings]) => ({
            key, readings, name: readings[readings.length - 1].analyte, latest: readings[readings.length - 1],
        }));
        const abnormal = (t: Trend) => (t.latest.flag && t.latest.flag !== 'normal' ? 0 : 1);
        return list.sort((a, b) => abnormal(a) - abnormal(b) || a.name.localeCompare(b.name));
    }, [labs]);

    if (!medications.length && !notes.length && !labs.length) {
        return (
            <div className="card border-0 shadow-sm rounded-3 p-5 text-center">
                <i className="bi bi-clipboard2-pulse fs-1 text-muted mb-3"></i>
                <h5 className="fw-bold text-dark">No health data yet</h5>
                <p className="text-muted small mb-0">Upload a prescription or test report. Medicines, diagnoses and test results are read automatically and appear here.</p>
            </div>
        );
    }

    const sourceLink = (recordId: string) => (
        <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none small" onClick={() => onViewSource(recordId)}>
            <i className="bi bi-file-earmark-text me-1"></i>View source
        </button>
    );

    return (
        <div className="d-flex flex-column gap-4">
            {/* Summary */}
            <div className="row g-3">
                {[
                    { label: 'Medicines on record', value: medications.length, icon: 'bi-capsule' },
                    { label: 'Tests tracked', value: trends.length, icon: 'bi-graph-up' },
                    { label: 'Abnormal latest results', value: trends.filter(t => t.latest.flag && t.latest.flag !== 'normal').length, icon: 'bi-exclamation-triangle' },
                    { label: 'Conditions & allergies', value: conditions.length, icon: 'bi-heart-pulse' },
                ].map(s => (
                    <div key={s.label} className="col-6 col-lg-3">
                        <div className="card border-0 shadow-sm rounded-3 h-100 p-3">
                            <div className="small text-muted"><i className={`bi ${s.icon} me-1`}></i>{s.label}</div>
                            <div className="fs-3 fw-bold" style={{ color: ACCENT }}>{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Conditions & allergies */}
            {conditions.length > 0 && (
                <div className="card border-0 shadow-sm rounded-3 p-3">
                    <h6 className="fw-bold mb-3"><i className="bi bi-heart-pulse me-2" style={{ color: ACCENT }}></i>Conditions & Allergies</h6>
                    <div className="d-flex flex-wrap gap-2">
                        {conditions.map(c => (
                            <span key={c.type + c.content}
                                className={`badge rounded-pill px-3 py-2 fw-normal ${c.type === 'allergy' ? 'bg-danger-subtle text-danger-emphasis' : 'bg-light text-dark border'}`}
                                title={fmtDate(c.date)} style={{ fontSize: '13px' }}>
                                {c.type === 'allergy' && <i className="bi bi-exclamation-octagon me-1"></i>}
                                {c.type === 'allergy' ? `Allergy: ${c.content}` : c.content}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Latest prescription */}
            {latestRx && (
                <div className="card border-0 shadow-sm rounded-3 p-3">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold m-0"><i className="bi bi-capsule me-2" style={{ color: ACCENT }}></i>Latest Prescription · {fmtDate(latestRx.date)}</h6>
                        {sourceLink(latestRx.recordId)}
                    </div>
                    <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0 small">
                            <thead className="table-light">
                                <tr><th>Medicine</th><th>Strength</th><th>Dose / Frequency</th><th>Duration</th><th>Instructions</th></tr>
                            </thead>
                            <tbody>
                                {latestRx.meds.map(m => (
                                    <tr key={m.id}>
                                        <td><strong>{[m.form, m.drug_name].filter(Boolean).join(' ')}</strong>{m.generic_name && <div className="text-muted">{m.generic_name}</div>}</td>
                                        <td>{m.strength || '—'}</td>
                                        <td>{[m.dose, m.frequency].filter(Boolean).join(' · ') || '—'}</td>
                                        <td>{m.duration || '—'}</td>
                                        <td>{m.instructions || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {latestRx.notes.length > 0 && (
                        <ul className="list-unstyled small mt-3 mb-0 d-flex flex-column gap-1">
                            {latestRx.notes.map(n => (
                                <li key={n.id}><span className="text-muted text-capitalize me-2">{n.note_type.replace('_', ' ')}:</span>{n.content}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Lab trends */}
            {trends.length > 0 && (
                <div className="card border-0 shadow-sm rounded-3 p-3">
                    <h6 className="fw-bold mb-3"><i className="bi bi-graph-up me-2" style={{ color: ACCENT }}></i>Test Results & Trends</h6>
                    <div className="row g-3">
                        {trends.map(t => {
                            const points = t.readings.filter(r => r.value_num !== null).map(r => ({ v: r.value_num as number, flag: r.flag }));
                            const l = t.latest;
                            return (
                                <div key={t.key} className="col-12 col-md-6 col-xl-4">
                                    <div className="border rounded-3 p-3 h-100">
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <div className="fw-semibold">{t.name}</div>
                                                <div className="small text-muted">{l.test_name || ''}</div>
                                            </div>
                                            <FlagBadge flag={l.flag} />
                                        </div>
                                        <div className="d-flex justify-content-between align-items-end mt-2">
                                            <div>
                                                <span className="fs-4 fw-bold">{l.value_num ?? l.value_text ?? '—'}</span>
                                                <span className="small text-muted ms-1">{l.unit}</span>
                                                <div className="small text-muted">Normal: {l.ref_text || (l.ref_low !== null && l.ref_high !== null ? `${l.ref_low}–${l.ref_high}` : '—')}</div>
                                            </div>
                                            {points.length > 0 && <Sparkline points={points} refLow={l.ref_low} refHigh={l.ref_high} />}
                                        </div>
                                        <div className="d-flex justify-content-between small text-muted mt-2">
                                            <span>{t.readings.length} reading{t.readings.length > 1 ? 's' : ''} · last {fmtDate(l.sample_date)}</span>
                                            {sourceLink(l.record_id)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Report summaries */}
            {insights.length > 0 && (
                <div className="card border-0 shadow-sm rounded-3 p-3">
                    <h6 className="fw-bold mb-3"><i className="bi bi-clipboard2-pulse me-2" style={{ color: ACCENT }}></i>Report Summaries</h6>
                    <div className="d-flex flex-column gap-3">
                        {insights.slice(0, 5).map(i => (
                            <div key={i.record_id} className="border-start border-3 ps-3" style={{ borderColor: ACCENT }}>
                                <div className="small">{i.summary}</div>
                                {i.abnormal_findings.length > 0 && (
                                    <div className="d-flex flex-wrap gap-1 mt-2">
                                        {i.abnormal_findings.map(f => <span key={f} className="badge bg-warning-subtle text-warning-emphasis fw-normal">{f}</span>)}
                                    </div>
                                )}
                                <div className="mt-1">{sourceLink(i.record_id)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Medicine history */}
            {olderMeds.length > 0 && (
                <details className="card border-0 shadow-sm rounded-3 p-3">
                    <summary className="fw-bold" style={{ cursor: 'pointer' }}>
                        <i className="bi bi-clock-history me-2" style={{ color: ACCENT }}></i>Earlier Prescriptions ({olderMeds.length})
                    </summary>
                    <div className="d-flex flex-column gap-3 mt-3">
                        {olderMeds.map(([recordId, meds]) => (
                            <div key={recordId}>
                                <div className="d-flex justify-content-between small text-muted mb-1">
                                    <span>{fmtDate(meds[0].prescribed_on)}</span>
                                    {sourceLink(recordId)}
                                </div>
                                <div className="small">
                                    {meds.map(m => [m.form, m.drug_name, m.strength, m.frequency, m.duration].filter(Boolean).join(' ')).join(' · ')}
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

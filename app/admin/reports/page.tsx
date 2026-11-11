import React from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';

const ACCENT = '#1B2978';
// k-anonymity: groups with fewer patients than this are hidden so no individual can be singled out.
const MIN_PATIENTS = Math.max(1, Number(process.env.ANALYTICS_MIN_PATIENTS) || 3);
const TOP = 15;

type Diagnosis = { diagnosis: string; mentions: number; patients: number };
type Medicine = { medicine: string; prescriptions: number; patients: number };
type Lab = { analyte: string; unit: string | null; readings: number; abnormal_readings: number; high_readings: number; low_readings: number; patients: number; avg_value: number | null };
type Allergy = { allergy: string; patients: number };
type Status = { record_type: string; extraction_status: string; documents: number };

const cap = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

function Bar({ value, max, color = ACCENT }: { value: number; max: number; color?: string }) {
    return (
        <div className="bg-light rounded" style={{ height: 8, minWidth: 80 }}>
            <div className="rounded" style={{ height: 8, width: `${max ? Math.max(4, (value / max) * 100) : 0}%`, backgroundColor: color }} />
        </div>
    );
}

function Section({ title, icon, children, empty }: { title: string; icon: string; children: React.ReactNode; empty: boolean }) {
    return (
        <div className="card border-0 shadow-sm rounded-3 p-3 h-100">
            <h6 className="fw-bold mb-3"><i className={`bi ${icon} me-2`} style={{ color: ACCENT }}></i>{title}</h6>
            {empty ? <p className="text-muted small mb-0">Not enough data yet.</p> : children}
        </div>
    );
}

export default async function AdminReportsPage() {
    await requireRole(['admin']);
    const supabase = await createClient();

    const [diag, meds, labs, allergies, status] = await Promise.all([
        supabase.from('analytics_diagnoses').select('diagnosis, mentions, patients').gte('patients', MIN_PATIENTS).order('patients', { ascending: false }).limit(TOP),
        supabase.from('analytics_medications').select('medicine, prescriptions, patients').gte('patients', MIN_PATIENTS).order('prescriptions', { ascending: false }).limit(TOP),
        supabase.from('analytics_lab_tests').select('analyte, unit, readings, abnormal_readings, high_readings, low_readings, patients, avg_value').gte('patients', MIN_PATIENTS).order('readings', { ascending: false }).limit(TOP),
        supabase.from('analytics_allergies').select('allergy, patients').gte('patients', MIN_PATIENTS).order('patients', { ascending: false }).limit(TOP),
        supabase.from('analytics_extraction_status').select('record_type, extraction_status, documents'),
    ]);

    const diagnoses = (diag.data || []) as Diagnosis[];
    const medicines = (meds.data || []) as Medicine[];
    const labTests = ((labs.data || []) as Lab[]).sort((a, b) => b.abnormal_readings / b.readings - a.abnormal_readings / a.readings);
    const allergyRows = (allergies.data || []) as Allergy[];
    const statusRows = (status.data || []) as Status[];
    const docs = (s: string) => statusRows.filter(r => r.extraction_status === s).reduce((n, r) => n + r.documents, 0);
    const queryError = [diag, meds, labs, allergies, status].find(r => r.error)?.error;

    return (
        <main className="main pt-5" style={{ backgroundColor: '#F5F9FC' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="admin" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="mb-4 pb-3" style={{ borderBottom: `3px solid ${ACCENT}` }}>
                            <h2 className="m-0" style={{ color: ACCENT }}>Health Insights</h2>
                            <p className="text-muted small mb-0 mt-1">
                                Anonymous, hospital-wide totals from uploaded prescriptions and test reports. No patient is identifiable;
                                groups with fewer than {MIN_PATIENTS} patients are hidden.
                            </p>
                        </div>

                        {queryError && <div className="alert alert-danger small">Could not load analytics: {queryError.message}</div>}

                        <div className="row g-3 mb-4">
                            {[
                                { label: 'Documents read', value: docs('done'), icon: 'bi-check-circle' },
                                { label: 'In queue', value: docs('pending') + docs('processing'), icon: 'bi-hourglass-split' },
                                { label: 'Could not read', value: docs('failed'), icon: 'bi-exclamation-circle' },
                                { label: 'Lab tests tracked', value: labTests.length, icon: 'bi-graph-up' },
                            ].map(k => (
                                <div key={k.label} className="col-6 col-lg-3">
                                    <div className="card border-0 shadow-sm rounded-3 p-3 h-100">
                                        <div className="small text-muted"><i className={`bi ${k.icon} me-1`}></i>{k.label}</div>
                                        <div className="fs-3 fw-bold" style={{ color: ACCENT }}>{k.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="row g-4">
                            <div className="col-lg-6">
                                <Section title="Most Common Diagnoses" icon="bi-clipboard2-pulse" empty={!diagnoses.length}>
                                    <table className="table table-sm align-middle small mb-0">
                                        <thead><tr><th>Diagnosis</th><th className="text-end">Patients</th><th style={{ width: '35%' }}></th></tr></thead>
                                        <tbody>
                                            {diagnoses.map(d => (
                                                <tr key={d.diagnosis}><td>{cap(d.diagnosis)}</td><td className="text-end fw-semibold">{d.patients}</td><td><Bar value={d.patients} max={diagnoses[0].patients} /></td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Section>
                            </div>

                            <div className="col-lg-6">
                                <Section title="Most Prescribed Medicines" icon="bi-capsule" empty={!medicines.length}>
                                    <table className="table table-sm align-middle small mb-0">
                                        <thead><tr><th>Medicine</th><th className="text-end">Prescriptions</th><th className="text-end">Patients</th><th style={{ width: '30%' }}></th></tr></thead>
                                        <tbody>
                                            {medicines.map(m => (
                                                <tr key={m.medicine}><td>{cap(m.medicine)}</td><td className="text-end fw-semibold">{m.prescriptions}</td><td className="text-end">{m.patients}</td><td><Bar value={m.prescriptions} max={medicines[0].prescriptions} /></td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Section>
                            </div>

                            <div className="col-12">
                                <Section title="Lab Tests — Share of Abnormal Results" icon="bi-graph-up" empty={!labTests.length}>
                                    <div className="table-responsive">
                                        <table className="table table-sm align-middle small mb-0">
                                            <thead><tr><th>Test</th><th className="text-end">Readings</th><th className="text-end">Patients</th><th className="text-end">High</th><th className="text-end">Low</th><th className="text-end">Average</th><th className="text-end">Abnormal</th><th style={{ width: '20%' }}></th></tr></thead>
                                            <tbody>
                                                {labTests.map(l => {
                                                    const pct = Math.round((l.abnormal_readings / l.readings) * 100);
                                                    return (
                                                        <tr key={l.analyte}>
                                                            <td>{cap(l.analyte)}</td>
                                                            <td className="text-end">{l.readings}</td>
                                                            <td className="text-end">{l.patients}</td>
                                                            <td className="text-end">{l.high_readings}</td>
                                                            <td className="text-end">{l.low_readings}</td>
                                                            <td className="text-end">{l.avg_value ?? '—'} {l.unit || ''}</td>
                                                            <td className="text-end fw-semibold">{pct}%</td>
                                                            <td><Bar value={pct} max={100} color={pct >= 50 ? '#dc3545' : pct >= 25 ? '#fd7e14' : ACCENT} /></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Section>
                            </div>

                            <div className="col-lg-6">
                                <Section title="Reported Allergies" icon="bi-exclamation-octagon" empty={!allergyRows.length}>
                                    <div className="d-flex flex-wrap gap-2">
                                        {allergyRows.map(a => (
                                            <span key={a.allergy} className="badge bg-danger-subtle text-danger-emphasis fw-normal px-3 py-2" style={{ fontSize: '13px' }}>
                                                {cap(a.allergy)} · {a.patients} patients
                                            </span>
                                        ))}
                                    </div>
                                </Section>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

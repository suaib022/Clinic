'use client';

import React, { useState, useRef } from 'react';
import {
  analyzeLabReportWithVision,
  publishLabReport,
  type LabVisionAnalysisResult,
  type AnalyteResult,
} from '@/lib/lab/reportUpload';

export interface ReportModalTarget {
  order_id: string;
  test: string;
  patient_name: string;
  patient_uhid: string;
  collected_at: string;
  expected_ready_at: string;
  doctor: string | null;
}

interface LabReportUploadModalProps {
  report: ReportModalTarget | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onDirectReady?: () => Promise<void>;
}

export default function LabReportUploadModal({ report, onClose, onSuccess, onDirectReady }: LabReportUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [analysis, setAnalysis] = useState<LabVisionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!report) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setAnalysis(null);
    setFile(selected);

    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreviewUrl(null);
    }
  };

  const runVisionAnalysis = async () => {
    if (!file) {
      setError('Please select an image or PDF report to analyze.');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const rawBase64 = (reader.result as string).split(',')[1];
          const res = await analyzeLabReportWithVision(report.order_id, rawBase64, file.type);
          if (res.ok && res.data) {
            setAnalysis(res.data);
          } else {
            setError(res.error || 'Vision analysis could not extract the document. You may retry or publish directly.');
          }
        } catch (err: any) {
          setError(err.message || 'Vision analysis failed.');
        } finally {
          setAnalyzing(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file from disk.');
        setAnalyzing(false);
      };
    } catch (err: any) {
      setError(err.message || 'Error processing file.');
      setAnalyzing(false);
    }
  };

  const handlePublish = async () => {
    if (!file || !analysis) {
      setError('Please analyze the report with Image Vision before publishing.');
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const rawBase64 = (reader.result as string).split(',')[1];
          const res = await publishLabReport({
            orderId: report.order_id,
            fileName: file.name,
            fileBase64: rawBase64,
            fileType: file.type,
            analysis,
          });

          if (res.ok) {
            onSuccess(res.message);
            onClose();
          } else {
            setError(res.message || 'Failed to save report.');
          }
        } catch (err: any) {
          setError(err.message || 'Publishing error.');
        } finally {
          setPublishing(false);
        }
      };
    } catch (err: any) {
      setError(err.message || 'Error uploading file.');
      setPublishing(false);
    }
  };

  const formatFlagBadge = (flag: AnalyteResult['flag']) => {
    switch (flag) {
      case 'high':
        return <span className="badge bg-danger-subtle text-danger fw-bold px-2 py-1">▲ High</span>;
      case 'low':
        return <span className="badge bg-warning-subtle text-warning-emphasis fw-bold px-2 py-1">▼ Low</span>;
      case 'critical':
      case 'abnormal':
        return <span className="badge bg-danger text-white fw-bold px-2 py-1">⚠ Critical</span>;
      case 'normal':
      default:
        return <span className="badge bg-success-subtle text-success fw-bold px-2 py-1">✓ Normal</span>;
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(14, 25, 84, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1055 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px', overflow: 'hidden' }}>
          
          {/* Header */}
          <div
            className="modal-header border-0 text-white px-4 py-3"
            style={{ backgroundColor: '#1B2978', borderBottom: '2px solid rgba(255,255,255,0.1)' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center bg-white text-primary rounded-circle"
                style={{ width: '44px', height: '44px', fontSize: '20px' }}
              >
                🔬
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0">Diagnostic Lab Report Verification & Vision AI</h5>
                <span className="small text-white-50">
                  Upload patient report, run OpenRouter multimodal vision analysis, and finalize results
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={analyzing || publishing}
              aria-label="Close"
            />
          </div>

          {/* Body */}
          <div className="modal-body p-4" style={{ backgroundColor: '#F5F9FC' }}>
            {error && (
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 py-2" role="alert">
                <i className="bi bi-exclamation-triangle-fill" />
                <div className="small flex-grow-1">{error}</div>
              </div>
            )}

            {/* Target Order & Patient Summary Banner */}
            <div className="card border-0 shadow-sm p-3 mb-4" style={{ borderRadius: '14px', backgroundColor: '#fff' }}>
              <div className="row g-3 align-items-center">
                <div className="col-md-4 border-end">
                  <div className="small text-muted text-uppercase fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    Patient Info
                  </div>
                  <div className="fw-bold text-dark fs-6 mt-1">{report.patient_name}</div>
                  <div className="small text-muted">
                    <span className="badge bg-secondary-subtle text-secondary me-2">{report.patient_uhid}</span>
                  </div>
                </div>

                <div className="col-md-4 border-end">
                  <div className="small text-muted text-uppercase fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    Investigation Test
                  </div>
                  <div className="fw-bold text-primary fs-6 mt-1">{report.test}</div>
                  <div className="small text-muted">
                    Prescribing Doctor: <strong>{report.doctor || 'Outside Physician'}</strong>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="small text-muted text-uppercase fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    Timeline & Status
                  </div>
                  <div className="small text-dark mt-1">
                    Sample Collected: <strong>{new Date(report.collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                  <div className="small text-muted">
                    Expected Ready: <strong>{new Date(report.expected_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 1: Upload File & Preview */}
            {!analysis && (
              <div className="card border-0 shadow-sm p-4 text-center" style={{ borderRadius: '16px', backgroundColor: '#fff' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="d-none"
                />

                {!file ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '14px',
                      padding: '48px 24px',
                      cursor: 'pointer',
                      backgroundColor: '#F8FAFC',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover-shadow"
                  >
                    <div className="display-4 text-primary mb-3">
                      <i className="bi bi-cloud-arrow-up" />
                    </div>
                    <h6 className="fw-bold text-dark mb-1">Click to Upload Diagnostic Report Document</h6>
                    <p className="text-muted small mb-3">
                      Supports high-resolution camera photos, scans, PNG, JPG, or PDF lab sheets
                    </p>
                    <button type="button" className="btn btn-outline-primary btn-sm px-4 rounded-pill">
                      Browse File
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded-3 mb-3 border">
                      <div className="d-flex align-items-center gap-3">
                        <i className={`bi ${file.type === 'application/pdf' ? 'bi-file-pdf text-danger' : 'bi-file-image text-primary'} fs-2`} />
                        <div className="text-start">
                          <div className="fw-semibold text-dark">{file.name}</div>
                          <div className="small text-muted">{(file.size / 1024).toFixed(1)} KB • {file.type || 'Document'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary rounded-pill"
                        onClick={() => {
                          setFile(null);
                          setPreviewUrl(null);
                        }}
                      >
                        Change File
                      </button>
                    </div>

                    {previewUrl && (
                      <div className="mb-4 text-center p-2 bg-light rounded border">
                        <img
                          src={previewUrl}
                          alt="Report preview"
                          style={{ maxHeight: '280px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                        />
                      </div>
                    )}

                    <div className="d-flex justify-content-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={runVisionAnalysis}
                        disabled={analyzing}
                        className="btn btn-primary px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
                        style={{ backgroundColor: '#1B2978', borderColor: '#1B2978', borderRadius: '10px' }}
                      >
                        {analyzing ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            Analyzing with OpenRouter Vision AI…
                          </>
                        ) : (
                          <>
                            <i className="bi bi-eye-fill" />
                            Extract & Verify Report with Vision AI
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Clear Vision Analysis Results Display */}
            {analysis && (
              <div className="d-flex flex-column gap-4">
                {/* Visual Vision Banner */}
                <div
                  className="card border-0 shadow-sm text-white p-4"
                  style={{
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #1B2978 0%, #0E1954 100%)',
                  }}
                >
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                      <span className="badge bg-white text-primary px-3 py-1 rounded-pill fw-bold mb-2">
                        ✓ Verified Diagnostic Report
                      </span>
                      <h4 className="fw-bold mb-1 text-white">{analysis.test_name}</h4>
                      <p className="mb-0 text-white-50 small">{analysis.report_title}</p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light rounded-pill px-3"
                      onClick={() => setAnalysis(null)}
                    >
                      <i className="bi bi-arrow-repeat me-1" /> Re-scan / Change File
                    </button>
                  </div>

                  <hr className="my-3 border-light opacity-25" />

                  {/* Clinical & Visit Details Grid */}
                  <div className="row g-3 text-start small">
                    <div className="col-md-3">
                      <div className="text-white-50">Consulting Doctor:</div>
                      <div className="fw-bold text-white fs-6">{analysis.doctor_info.name}</div>
                      <div className="text-white-50" style={{ fontSize: '12px' }}>{analysis.doctor_info.speciality}</div>
                    </div>

                    <div className="col-md-3">
                      <div className="text-white-50">Patient Details:</div>
                      <div className="fw-bold text-white fs-6">{analysis.patient_info.name}</div>
                      <div className="text-white-50" style={{ fontSize: '12px' }}>
                        UHID: {analysis.patient_info.uhid} {analysis.patient_info.gender ? `• ${analysis.patient_info.gender}` : ''}
                      </div>
                    </div>

                    <div className="col-md-3">
                      <div className="text-white-50">Sample & Collection Time:</div>
                      <div className="fw-bold text-white">
                        {analysis.timing_info.collected_at
                          ? new Date(analysis.timing_info.collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                          : 'Sample Collected'}
                      </div>
                      <div className="text-white-50" style={{ fontSize: '12px' }}>Order: {analysis.timing_info.order_date}</div>
                    </div>

                    <div className="col-md-3">
                      <div className="text-white-50">Report Processed Time:</div>
                      <div className="fw-bold text-white">
                        {new Date(analysis.timing_info.analyzed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Today)
                      </div>
                      <div className="text-white-50" style={{ fontSize: '12px' }}>Multimodal Vision Verified</div>
                    </div>
                  </div>
                </div>

                {/* Clinical Impression & Abnormal Summary */}
                <div className="card border-0 shadow-sm p-4" style={{ borderRadius: '16px', backgroundColor: '#fff' }}>
                  <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-clipboard2-pulse-fill text-primary" />
                    Clinical Summary & AI Impression
                  </h6>
                  <p className="text-secondary small mb-3">{analysis.summary}</p>

                  {analysis.abnormal_findings.length > 0 && (
                    <div className="p-3 bg-danger-subtle rounded-3 border border-danger-subtle">
                      <div className="fw-bold text-danger small mb-1">
                        <i className="bi bi-exclamation-circle-fill me-1" />
                        Attention Required ({analysis.abnormal_findings.length} Abnormal / Flagged Findings):
                      </div>
                      <ul className="mb-0 ps-3 small text-danger-emphasis">
                        {analysis.abnormal_findings.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Analytes & Readings Table */}
                <div className="card border-0 shadow-sm p-4" style={{ borderRadius: '16px', backgroundColor: '#fff' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <i className="bi bi-list-check text-primary" />
                      Extracted Test Parameters & Measured Readings ({analysis.results.length})
                    </h6>
                    <span className="small text-muted">All values verified against reference intervals</span>
                  </div>

                  {analysis.results.length === 0 ? (
                    <div className="text-center py-4 text-muted small">
                      No tabular analytes detected. Clinical summary and document have been recorded.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th className="small text-uppercase text-secondary">Test Parameter</th>
                            <th className="small text-uppercase text-secondary text-center">Measured Result</th>
                            <th className="small text-uppercase text-secondary">Unit</th>
                            <th className="small text-uppercase text-secondary">Reference Interval</th>
                            <th className="small text-uppercase text-secondary text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.results.map((r, idx) => (
                            <tr key={idx} className={r.flag !== 'normal' ? 'table-warning-subtle' : ''}>
                              <td className="fw-semibold text-dark">{r.analyte}</td>
                              <td className="text-center fw-bold fs-6">
                                <span className={r.flag === 'high' || r.flag === 'critical' ? 'text-danger' : r.flag === 'low' ? 'text-warning-emphasis' : 'text-dark'}>
                                  {r.value_text}
                                </span>
                              </td>
                              <td className="small text-muted">{r.unit || '—'}</td>
                              <td className="small text-muted">{r.ref_text || (r.ref_low != null && r.ref_high != null ? `${r.ref_low} – ${r.ref_high}` : '—')}</td>
                              <td className="text-center">{formatFlagBadge(r.flag)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="modal-footer border-0 px-4 py-3 bg-white d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary px-4 rounded-pill"
                onClick={onClose}
                disabled={analyzing || publishing}
              >
                Close
              </button>
              {!analysis && onDirectReady && (
                <button
                  type="button"
                  className="btn btn-link text-decoration-none text-muted small"
                  onClick={async () => {
                    setPublishing(true);
                    try {
                      await onDirectReady();
                    } finally {
                      setPublishing(false);
                    }
                  }}
                  disabled={analyzing || publishing}
                >
                  <i className="bi bi-arrow-right-circle me-1" />
                  Mark Ready Without Document
                </button>
              )}
            </div>

            {analysis && (
              <button
                type="button"
                className="btn btn-success px-4 py-2 rounded-pill fw-semibold shadow-sm d-inline-flex align-items-center gap-2"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    Saving Report & Marking Ready…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill" />
                    Confirm & Publish Report (Mark Ready)
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

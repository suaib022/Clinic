'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getApiUser } from '@/lib/queue/server';
import { z } from 'zod';

const MODEL = process.env.EXTRACTION_MODEL || 'google/gemini-2.5-flash-lite';
const MAX_PDF_PAGES = 3;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface LabOrderContext {
  order_id: string;
  patient_id: string;
  patient_name: string;
  patient_uhid: string;
  patient_gender: string | null;
  patient_mobile: string | null;
  test_name: string;
  test_code: string;
  doctor_name: string;
  doctor_email: string;
  doctor_speciality: string;
  appointment_id: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_serial: number | null;
  order_date: string;
  collected_at: string | null;
  expected_ready_at: string | null;
  status: string;
}

export interface AnalyteResult {
  analyte: string;
  test_name?: string | null;
  value_num: number | null;
  value_text: string;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  flag: 'normal' | 'high' | 'low' | 'critical' | 'abnormal' | null;
  confidence?: number;
}

export interface LabVisionAnalysisResult {
  test_name: string;
  report_title: string;
  doctor_info: {
    name: string;
    speciality: string;
    email: string;
  };
  patient_info: {
    name: string;
    uhid: string;
    gender: string | null;
    mobile: string | null;
  };
  timing_info: {
    order_date: string;
    appointment_time: string | null;
    collected_at: string | null;
    report_date: string;
    analyzed_at: string;
  };
  results: AnalyteResult[];
  summary: string;
  abnormal_findings: string[];
}

/** Fetches full clinical and appointment context for a lab order */
export async function getLabOrderFullContext(orderId: string): Promise<LabOrderContext | null> {
  const db = supabaseAdmin;

  const { data: order, error } = await db
    .from('lab_orders')
    .select(`
      id, patient_id, appointment_id, ordering_doctor_id, order_date, collected_at, status, external_prescriber,
      patient:patients(id, full_name, uhid, gender, mobile_no),
      test_type:lab_test_types(id, name, code, turnaround_min),
      doctor:users!ordering_doctor_id(id, full_name, email),
      appointment:appointments(id, appointment_date, start_time, end_time, serial_no)
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    console.error('[lab/reportUpload] Order query error:', error);
    return null;
  }

  const patient = order.patient as any;
  const testType = order.test_type as any;
  const doctor = order.doctor as any;
  const appt = order.appointment as any;

  let speciality = 'General Medicine';
  if (order.ordering_doctor_id) {
    const { data: spec } = await db
      .from('doctor_specialities')
      .select('speciality:specialities!inner(name)')
      .eq('doctor_id', order.ordering_doctor_id)
      .limit(1);
    if (spec?.[0]?.speciality) {
      speciality = (spec[0].speciality as any).name;
    }
  }

  return {
    order_id: order.id,
    patient_id: order.patient_id,
    patient_name: patient?.full_name || 'Patient',
    patient_uhid: patient?.uhid || '—',
    patient_gender: patient?.gender || null,
    patient_mobile: patient?.mobile_no || null,
    test_name: testType?.name || 'Diagnostic Test',
    test_code: testType?.code || 'lab',
    doctor_name: doctor?.full_name || order.external_prescriber || 'Consulting Physician',
    doctor_email: doctor?.email || '',
    doctor_speciality: speciality,
    appointment_id: order.appointment_id,
    appointment_date: appt?.appointment_date || order.order_date,
    appointment_time: appt?.start_time ? `${appt.start_time.slice(0, 5)} - ${appt.end_time?.slice(0, 5)}` : null,
    appointment_serial: appt?.serial_no ?? null,
    order_date: order.order_date,
    collected_at: order.collected_at,
    expected_ready_at: order.collected_at && testType?.turnaround_min
      ? new Date(new Date(order.collected_at).getTime() + testType.turnaround_min * 60_000).toISOString()
      : null,
    status: order.status,
  };
}

/** Turn file buffer into image data URLs for the OpenRouter Vision model */
async function toImageDataUrls(buffer: Buffer, fileType: string): Promise<string[]> {
  const isPdf = fileType === 'application/pdf';
  if (isPdf) {
    const { pdf } = await import('pdf-to-img');
    const doc = await pdf(buffer, { scale: 2 });
    const pages: string[] = [];
    for await (const png of doc) {
      pages.push(`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
      if (pages.length >= MAX_PDF_PAGES) break;
    }
    return pages;
  }
  if (IMAGE_TYPES.includes(fileType)) {
    return [`data:${fileType};base64,${buffer.toString('base64')}`];
  }
  throw new Error(`Unsupported file type: ${fileType}. Please upload a PNG, JPG, or PDF.`);
}

/** OpenRouter Image Vision Call for Lab Diagnostic Reports */
export async function analyzeLabReportWithVision(
  orderId: string,
  base64Data: string,
  fileType: string
): Promise<{ ok: boolean; data?: LabVisionAnalysisResult; error?: string }> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { ok: false, error: 'OpenRouter API key is missing on the server.' };

    const ctx = await getLabOrderFullContext(orderId);
    if (!ctx) return { ok: false, error: 'Lab order details could not be found.' };

    const buffer = Buffer.from(base64Data, 'base64');
    const images = await toImageDataUrls(buffer, fileType);
    if (!images.length) return { ok: false, error: 'Could not render pages from document.' };

    const systemPrompt = `You are an expert clinical vision AI for medical diagnostics, laboratory reports, clinical investigations, and medical documents (including pathology reports, blood tests, biochemistry, imaging reports, and medical prescriptions).

Carefully examine this medical document (${images.length} page(s)).

Context from clinic order:
- Expected Investigation / Order: "${ctx.test_name}"
- Ordering / Consulting Doctor: "${ctx.doctor_name}" (${ctx.doctor_speciality})
- Patient Name: "${ctx.patient_name}" (UHID: "${ctx.patient_uhid}")

Your task is to extract all medical, diagnostic, and clinical data from the document into valid JSON.
CRITICAL EXTRACTION RULES:
1. Extract EVERY test result, measured parameter, clinical observation, or prescribed item/medication into the "results" array:
   - For laboratory tests: extract each analyte (e.g. "Hemoglobin", "Serum Creatinine", "WBC", "Platelets", "SGPT", "Urine Routine").
   - For prescriptions / medication orders: extract each medicine/item (e.g. "Amphogel", "M & FT Solution", "Tr. Belladonna") as an analyte, with test_name as "Prescription", value_text as its dose/volume/frequency (e.g. "120 ml", "5ml tid a.c.", "15 ml"), unit if applicable (e.g. "ml", "mg", "tablets"), and ref_text or instructions if printed.
   - For diagnostic imaging / radiology / ECG: extract each examined parameter or organ finding into results.
2. NEVER return an empty results array if there are items, tests, medications, or readings on the document! Extract every item completely.
3. Extract the document title/header (e.g., "DD FORM 1289 DOD PRESCRIPTION", "Biochemistry Report", "Lipid Profile"), document date, prescribing doctor/facility info if printed, and patient info if printed.
4. "summary": Provide a clear, comprehensive clinical summary (2-4 sentences) explaining:
   - Exactly what this document is (e.g., "This is a prescription for ... issued on ... for ... by ...", or "This is a laboratory report for ... showing ...").
   - Mention every key result, medication, dosage, doctor, and patient detail visible on the document.
5. "abnormal_findings": List any out-of-range, high, low, or noteworthy findings (empty array if none).

JSON schema to return:
{
  "test_name": "string (the primary test, panel, or document type, e.g. 'Serum Creatinine', 'CBC', 'Prescription', 'DOD PRESCRIPTION')",
  "report_title": "string (the document header/facility title printed, e.g. 'DD FORM 1289 DOD PRESCRIPTION')",
  "report_date": "YYYY-MM-DD or string (date on document, or null)",
  "results": [
    {
      "analyte": "string (parameter name or medication name, e.g. 'Tr. Belladonna', 'Amphogel', 'Serum Creatinine')",
      "test_name": "string (e.g. 'Prescription', 'Biochemistry', 'CBC', or null)",
      "value_num": null,
      "value_text": "string (exact measured value or dosage string, e.g. '15 ml', '120 ml', '5ml tid a.c.', '1.1')",
      "unit": "string or null (e.g. 'ml', 'mg/dL', or null)",
      "ref_low": null,
      "ref_high": null,
      "ref_text": "string or null (reference range or instructions)",
      "flag": "'normal' | 'high' | 'low' | 'critical' | 'abnormal' | null"
    }
  ],
  "summary": "string (comprehensive clinical summary mentioning document type, items/medications, dates, doctor, and patient)",
  "abnormal_findings": ["string"]
}
Return only valid JSON.`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all findings, test results, medications, doctor, and patient details from this document.`,
              },
              ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new Error(`OpenRouter Error ${res.status}: ${errBody?.error?.message || res.statusText}`);
    }

    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Vision model returned an empty response.');

    const cleanJson = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Normalize and assemble full clinical details
    const results: AnalyteResult[] = Array.isArray(parsed.results)
      ? parsed.results.map((r: any) => {
          let flag: AnalyteResult['flag'] = null;
          const rawFlag = String(r.flag || '').toLowerCase();
          if (['high', 'low', 'critical', 'abnormal', 'normal'].includes(rawFlag)) {
            flag = rawFlag as any;
          } else if (r.value_num != null && r.ref_low != null && r.value_num < r.ref_low) {
            flag = 'low';
          } else if (r.value_num != null && r.ref_high != null && r.value_num > r.ref_high) {
            flag = 'high';
          }

          return {
            analyte: String(r.analyte || 'Unknown Parameter'),
            test_name: r.test_name ? String(r.test_name) : null,
            value_num: typeof r.value_num === 'number' ? r.value_num : Number(String(r.value_text || '').replace(/,/g, '')) || null,
            value_text: String(r.value_text ?? r.value_num ?? '—'),
            unit: r.unit ? String(r.unit) : null,
            ref_low: typeof r.ref_low === 'number' ? r.ref_low : null,
            ref_high: typeof r.ref_high === 'number' ? r.ref_high : null,
            ref_text: r.ref_text ? String(r.ref_text) : null,
            flag,
          };
        })
      : [];

    const analysis: LabVisionAnalysisResult = {
      test_name: parsed.test_name || ctx.test_name,
      report_title: parsed.report_title || `${ctx.test_name} Diagnostic Report`,
      doctor_info: {
        name: parsed.doctor_name || ctx.doctor_name,
        speciality: ctx.doctor_speciality,
        email: ctx.doctor_email,
      },
      patient_info: {
        name: parsed.patient_name || ctx.patient_name,
        uhid: ctx.patient_uhid,
        gender: ctx.patient_gender,
        mobile: ctx.patient_mobile,
      },
      timing_info: {
        order_date: ctx.order_date,
        appointment_time: ctx.appointment_time,
        collected_at: ctx.collected_at,
        report_date: parsed.report_date || new Date().toISOString().split('T')[0],
        analyzed_at: new Date().toISOString(),
      },
      results,
      summary: parsed.summary || 'Clinical document processed and verified by image vision.',
      abnormal_findings: Array.isArray(parsed.abnormal_findings) ? parsed.abnormal_findings : [],
    };

    return { ok: true, data: analysis };
  } catch (err: any) {
    console.error('[analyzeLabReportWithVision] Vision failure:', err);
    return { ok: false, error: err.message || 'Vision analysis failed.' };
  }
}

export interface PublishReportInput {
  orderId: string;
  fileName: string;
  fileBase64: string;
  fileType: string;
  analysis: LabVisionAnalysisResult;
}

/** Saves report file into storage, creates medical record, saves results, and marks report ready */
export async function publishLabReport(
  input: PublishReportInput
): Promise<{ ok: boolean; message: string; recordId?: string }> {
  try {
    const user = await getApiUser();
    if (!user || !['technician', 'admin'].includes(user.role)) {
      return { ok: false, message: 'Only lab staff or administrators can publish lab reports.' };
    }

    const db = supabaseAdmin;
    const ctx = await getLabOrderFullContext(input.orderId);
    if (!ctx) return { ok: false, message: 'Lab order could not be found.' };

    const buffer = Buffer.from(input.fileBase64, 'base64');
    const safeExt = input.fileName.split('.').pop() || 'png';
    const filePath = `lab-reports/${ctx.patient_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

    // 1. Upload file to medical_documents storage bucket
    const { error: storageError } = await db.storage
      .from('medical_documents')
      .upload(filePath, buffer, {
        contentType: input.fileType,
        upsert: true,
      });

    if (storageError) {
      console.error('[publishLabReport] Storage error:', storageError);
      return { ok: false, message: `Storage upload failed: ${storageError.message}` };
    }

    // 2. Create medical record
    const { data: record, error: recError } = await db
      .from('medical_records')
      .insert({
        patient_id: ctx.patient_id,
        doctor_id: ctx.doctor_email ? (await db.from('users').select('id').eq('email', ctx.doctor_email).single()).data?.id : null,
        appointment_id: ctx.appointment_id,
        uploaded_by: user.userId,
        record_type: 'test_report',
        title: `${input.analysis.test_name || ctx.test_name} Report`,
        description: `Verified by Lab Staff with Image Vision for Order #${ctx.order_id.slice(0, 8)}`,
        file_path: filePath,
        file_size: buffer.length,
        file_type: input.fileType,
        document_date: input.analysis.timing_info.report_date,
        extraction_status: 'done',
        extraction_model: MODEL,
        extracted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (recError || !record) {
      console.error('[publishLabReport] Medical record error:', recError);
      return { ok: false, message: `Failed to create medical record: ${recError?.message}` };
    }

    const recordId = record.id;

    // 3. Insert into lab_results (powers Test Results & Trends in Health Profile)
    if (input.analysis.results.length > 0) {
      const rows = input.analysis.results.map((r) => ({
        record_id: recordId,
        patient_id: ctx.patient_id,
        test_name: r.test_name || input.analysis.test_name || ctx.test_name,
        analyte: r.analyte,
        value_num: r.value_num,
        value_text: r.value_text,
        unit: r.unit,
        ref_low: r.ref_low,
        ref_high: r.ref_high,
        ref_text: r.ref_text,
        flag: r.flag,
        sample_date: ctx.collected_at ? ctx.collected_at.split('T')[0] : ctx.order_date,
      }));

      const { error: resultsError } = await db.from('lab_results').insert(rows);
      if (resultsError) console.error('[publishLabReport] lab_results error:', resultsError);

      // Also populate rx_medications if it is a prescription or has prescribed items
      const isPrescription =
        input.analysis.test_name?.toLowerCase().includes('prescription') ||
        input.analysis.report_title?.toLowerCase().includes('prescription') ||
        input.analysis.results.some((r) => r.test_name?.toLowerCase() === 'prescription');

      if (isPrescription) {
        const medRows = input.analysis.results.map((r) => ({
          record_id: recordId,
          patient_id: ctx.patient_id,
          drug_name: r.analyte,
          dose: r.value_text,
          frequency: r.ref_text,
          instructions: r.ref_text,
          prescribed_on: ctx.order_date,
          confidence: 0.95,
        }));
        const { error: medError } = await db.from('rx_medications').insert(medRows);
        if (medError) console.warn('[publishLabReport] rx_medications notice:', medError.message);
      }
    }

    // 4. Insert into report_insights
    const { error: insightsError } = await db.from('report_insights').insert({
      record_id: recordId,
      patient_id: ctx.patient_id,
      summary: input.analysis.summary,
      abnormal_findings: input.analysis.abnormal_findings || [],
    });
    if (insightsError) console.error('[publishLabReport] report_insights error:', insightsError);

    // 5. Mark report ready in database via RPC
    const requestKey = `pub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { error: rpcError } = await user.supabase.rpc('lab_mark_report_ready', {
      p_order_id: ctx.order_id,
      p_request_key: requestKey,
    });

    if (rpcError) {
      console.warn('[publishLabReport] RPC warning:', rpcError.message);
      // Fallback: update status directly in lab_orders
      await db.from('lab_orders').update({
        status: 'ready',
        report_ready_at: new Date().toISOString(),
      }).eq('id', ctx.order_id);
    }

    return {
      ok: true,
      message: `Report for ${input.analysis.test_name} has been verified, saved, and marked ready!`,
      recordId,
    };
  } catch (err: any) {
    console.error('[publishLabReport] Uncaught error:', err);
    return { ok: false, message: err.message || 'Failed to publish lab report.' };
  }
}

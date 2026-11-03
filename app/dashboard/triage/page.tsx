import React from 'react';
import { supabaseAdmin } from '@/lib/supabase/admin';
import TriageReviewClient, { TriageIntakeItem } from '@/components/triage/TriageReviewClient';
import DashboardSidebar from '@/components/DashboardSidebar';

export const metadata = {
    title: 'Aura Clinical Triage Desk | Clinic',
    description: '24/7 AI-Assisted Patient Symptom Triage, Nurse Escalations & Multimodal Review'
};

export default async function TriageReviewPage() {
    let intakes: TriageIntakeItem[] = [];

    // 1. Fetch live intakes from Supabase
    try {
        const { data, error } = await supabaseAdmin
            .from('triage_intakes')
            .select(`
                *,
                attachments:intake_attachments(*)
            `)
            .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
            intakes = data as TriageIntakeItem[];
        }
    } catch (e) {
        console.warn('Could not query triage_intakes:', e);
    }

    // 2. Fallback demonstration records if database has no entries yet
    if (intakes.length === 0) {
        intakes = [
            {
                id: 'intake_101',
                triage_ref: 'TRG-5A91F20C',
                patient_name: 'Tanvir Hossain',
                patient_phone: '+8801712345678',
                patient_mrn: 'UHID-88291041',
                conversation_id: 'conv_88912a7bf9',
                symptom_summary: 'Sudden onset acute chest discomfort, shortness of breath, and left arm numbness starting 45 minutes ago.',
                severity: 'immediate_review',
                duration_days: 1,
                has_file_attachment: true,
                status: 'pending_review',
                triage_protocol: 'Emergency Cardiac Protocol Delta-1',
                escalated_to_nurse: true,
                nurse_urgency_reason: 'Potential Acute Coronary Syndrome symptoms',
                sync_status: 'settled',
                created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                transcript: [
                    {
                        role: 'agent',
                        speaker: 'Aura (AI)',
                        message: 'Hello, this is Aura Clinical Triage. How can I help you today?',
                        timestamp: '00:01'
                    },
                    {
                        role: 'user',
                        speaker: 'Patient',
                        message: 'I have severe pressure on my chest and my left shoulder feels numb.',
                        timestamp: '00:14'
                    },
                    {
                        role: 'agent',
                        speaker: 'Aura (AI)',
                        message: 'These symptoms require immediate attention. I am dispatching a high-priority alert to our on-call triage nursing desk. Your reference number is TRG-5A91F20C.',
                        timestamp: '00:32'
                    }
                ],
                attachments: [
                    {
                        id: 'att_1',
                        filename: 'ecg_preliminary_trace.png',
                        file_type: 'image/png',
                        public_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80'
                    }
                ]
            },
            {
                id: 'intake_102',
                triage_ref: 'TRG-74B216E6',
                patient_name: 'Nasrin Sultana',
                patient_phone: '+8801823901122',
                patient_mrn: 'UHID-66381920',
                conversation_id: 'conv_66311029de',
                symptom_summary: 'Persistent dry cough, mild fever (100.4 F) and fatigue for 3 days. No breathing distress.',
                severity: 'moderate',
                duration_days: 3,
                has_file_attachment: false,
                status: 'under_review',
                triage_protocol: 'Respiratory Infection Clinical Pathway',
                escalated_to_nurse: false,
                sync_status: 'settled',
                created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                transcript: [
                    {
                        role: 'agent',
                        speaker: 'Aura (AI)',
                        message: 'Hello! Please describe what symptoms you are experiencing.',
                        timestamp: '00:01'
                    },
                    {
                        role: 'user',
                        speaker: 'Patient',
                        message: 'I have a mild fever around 100 degrees and a dry cough since Sunday.',
                        timestamp: '00:19'
                    },
                    {
                        role: 'agent',
                        speaker: 'Aura (AI)',
                        message: 'I have logged your symptoms into our clinical triage intake under reference TRG-74B216E6 with Moderate priority.',
                        timestamp: '00:48'
                    }
                ]
            },
            {
                id: 'intake_103',
                triage_ref: 'TRG-992A41BD',
                patient_name: 'Mahmudul Karim',
                patient_phone: '+8801911883344',
                patient_mrn: 'UHID-44129031',
                conversation_id: 'conv_44129031fc',
                symptom_summary: 'Routine medication refill request for Metformin 500mg and Telmisartan 40mg. Blood pressure reported stable at 122/80.',
                severity: 'mild',
                duration_days: 14,
                has_file_attachment: true,
                status: 'reviewed',
                triage_protocol: 'Chronic Disease Maintenance Protocol',
                escalated_to_nurse: false,
                sync_status: 'settled',
                doctor_notes: 'Refill approved for 90 days. Next HbA1c review scheduled in December.',
                created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                transcript: [
                    {
                        role: 'agent',
                        speaker: 'Aura (AI)',
                        message: 'Hello! Are you looking to schedule a visit or request a medication refill today?',
                        timestamp: '00:01'
                    },
                    {
                        role: 'user',
                        speaker: 'Patient',
                        message: 'I need a refill for my blood pressure and diabetes medicine.',
                        timestamp: '00:18'
                    },
                    {
                        role: 'agent',
                        speaker: 'Aura (AI)',
                        message: 'Your prescription refill request has been submitted under reference RX-901234. Estimated ready time within 2 hours.',
                        timestamp: '00:52'
                    }
                ],
                attachments: [
                    {
                        id: 'att_2',
                        filename: 'previous_prescription_sept.pdf',
                        file_type: 'application/pdf',
                        public_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
                    }
                ]
            }
        ];
    }

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff', minHeight: '100vh' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                {/* Admin/Doctor Sidebar navigation */}
                <DashboardSidebar role="doctor" />

                <div className="flex-grow-1 p-3 p-md-4">
                    <TriageReviewClient initialIntakes={intakes} />
                </div>
            </div>
        </main>
    );
}


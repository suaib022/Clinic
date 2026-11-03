import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { parseAgentMessage, extractReferenceId } from '../lib/chat/messageParser';
import { syncConversationSession } from '../lib/chat/syncSession';
import { supabaseAdmin } from '../lib/supabase/admin';

async function testAuraSystem() {
    console.log('--- STARTING AURA HEALTHCARE ASSISTANT TEST SUITE ---');

    // 1. Test Reference Regex
    console.log('[Test 1] Testing Strict Reference Regex Extraction...');
    const ref1 = extractReferenceId('Your appointment reference number is #APT-2026-881290 please keep it safe.');
    const ref2 = extractReferenceId('Triage intake reference is TRG-5A91F20C');
    const ref3 = extractReferenceId('Your refill request reference number is RX-901234');
    const ref4 = extractReferenceId('Let me know your phone number'); // Should be null

    console.log('Extracted refs:', { ref1, ref2, ref3, ref4 });
    if (ref1 !== 'APT-2026-881290' || ref2 !== 'TRG-5A91F20C' || ref3 !== 'RX-901234' || ref4 !== null) {
        console.error('Regex extraction test failed!');
        process.exit(1);
    }
    console.log('✓ Strict reference extraction verified.');

    // 2. Test Guardrails (Never parse appointment card when triage keywords are present)
    console.log('[Test 2] Testing Guardrails against False Appointment Cards...');
    const triageMessage = 'I have evaluated your chest pain and severe fever symptoms. Your triage intake reference number is TRG-74B216E6 with high severity for nurse review.';
    const triageCards = parseAgentMessage(triageMessage);
    console.log('Triage message parsed cards:', triageCards.map(c => c.type));

    const hasAppointmentCard = triageCards.some(c => c.type === 'appointment');
    const hasTriageCard = triageCards.some(c => c.type === 'triage');

    if (hasAppointmentCard) {
        console.error('Guardrail failed: Appointment card was erroneously generated for symptom triage message!');
        process.exit(1);
    }
    if (!hasTriageCard) {
        console.error('Expected triage card was not generated!');
        process.exit(1);
    }
    console.log('✓ Guardrail verified: appointment card suppressed during symptom triage.');

    // 3. Test Legitimate Appointment Card Generation
    console.log('[Test 3] Testing Legitimate Appointment Confirmation Card Generation...');
    const apptMessage = 'Your appointment with Dr. A.K.S Zahid Mahmud Khan in Cardiology is confirmed for tomorrow. Your reference number is APT-2026-881290.';
    const apptCards = parseAgentMessage(apptMessage);
    console.log('Appointment message parsed cards:', apptCards.map(c => c.type));

    if (!apptCards.some(c => c.type === 'appointment')) {
        console.error('Failed to parse legitimate appointment card!');
        process.exit(1);
    }
    console.log('✓ Appointment card generation verified.');

    // 4. Test Action Choice Card
    console.log('[Test 4] Testing Action Choice Buttons Detection...');
    const choiceMessage = 'Would you like to fill out a patient intake form or would you prefer to continue chatting with me?';
    const choiceCards = parseAgentMessage(choiceMessage);
    console.log('Choice message parsed cards:', choiceCards.map(c => c.type));

    if (!choiceCards.some(c => c.type === 'action_choice')) {
        console.error('Failed to parse action choice card!');
        process.exit(1);
    }
    console.log('✓ Action choice card generation verified.');

    // 5. Test Prescription Refill Card
    console.log('[Test 5] Testing Prescription Refill Card Generation...');
    const rxMessage = 'Your prescription refill request for Metformin 500mg has been submitted to the Central Hospital Pharmacy. Your reference number is RX-901234.';
    const rxCards = parseAgentMessage(rxMessage);
    console.log('Prescription message parsed cards:', rxCards.map(c => c.type));

    if (!rxCards.some(c => c.type === 'prescription')) {
        console.error('Failed to parse prescription card!');
        process.exit(1);
    }
    console.log('✓ Prescription card generation verified.');

    // 6. Test syncSession Utility
    console.log('[Test 6] Testing syncConversationSession utility...');
    const syncRes = await syncConversationSession('conv_test_simulation_' + Date.now());
    console.log('Sync Result:', {
        success: syncRes.success,
        turnsCount: syncRes.turnsCount,
        status: syncRes.status
    });

    if (!syncRes.success) {
        console.error('Sync session test failed!');
        process.exit(1);
    }
    console.log('✓ Sync session utility verified.');

    console.log('--- ALL AURA AI SYSTEM TESTS PASSED SUCCESSFULLY! ---');
}

testAuraSystem().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});


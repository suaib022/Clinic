export type CardType = 'appointment' | 'triage' | 'prescription' | 'action_choice';

export interface AppointmentCardData {
    bookingId: string;
    doctorName: string;
    specialty: string;
    datetime: string;
    roomOrLink: string;
    isTelehealth: boolean;
    milestones: {
        scheduled: boolean;
        confirmed: boolean;
        doctorAssigned: boolean;
    };
}

export interface TriageCardData {
    referenceId: string;
    urgency: 'Low' | 'Moderate' | 'Immediate Nurse Review';
    protocol: string;
    summary?: string;
    escalatedToNurse?: boolean;
}

export interface PrescriptionCardData {
    refillId: string;
    medication: string;
    dosage: string;
    pharmacy: string;
    estimatedReady: string;
}

export interface ActionChoiceCardData {
    prompt: string;
    primaryAction: {
        label: string;
        actionKey: string;
    };
    secondaryAction: {
        label: string;
        actionKey: string;
    };
}

export interface ParsedCard {
    id: string;
    type: CardType;
    data: AppointmentCardData | TriageCardData | PrescriptionCardData | ActionChoiceCardData;
    rawMessage: string;
}

// Strict reference extraction regex specified in architectural requirements
const STRICT_REF_REGEX = /reference\s*(?:number\s*)?(?:is\s*)?#?([a-f0-9]{8}|[A-Za-z0-9_-]{6,})/i;

// Guardrail keywords: never show appointment card when conversation is discussing clinical triage/symptoms
const TRIAGE_GUARDRAIL_KEYWORDS = [
    'triage',
    'emergency',
    'symptom',
    'symptoms',
    'pain',
    'fever',
    'cough',
    'vomiting',
    'nausea',
    'wound',
    'bleeding',
    'chest pain',
    'difficulty breathing',
    'injury',
    'intake',
    'vital',
    'nurse review',
    'escalat'
];

/**
 * Extracts a normalized reference ID from agent message.
 */
export function extractReferenceId(text: string): string | null {
    if (!text) return null;

    // First check for explicit prefixed IDs (e.g. TRG-..., APT-..., RX-...)
    const prefixedMatch = text.match(/\b(TRG-[A-Za-z0-9]{6,12}|APT-[A-Za-z0-9_-]{6,16}|RX-[A-Za-z0-9]{6,12})\b/i);
    if (prefixedMatch) {
        return prefixedMatch[1].toUpperCase();
    }

    // Use strict architectural capture regex
    const match = text.match(STRICT_REF_REGEX);
    if (match && match[1]) {
        const rawId = match[1].trim();
        // Avoid matching common conversational words
        const invalidWords = ['number', 'appointment', 'booking', 'doctor', 'clinic', 'reference', 'please', 'today'];
        if (!invalidWords.includes(rawId.toLowerCase())) {
            return rawId.toUpperCase();
        }
    }

    return null;
}

/**
 * Parses agent message and returns rich generative UI cards if intent and criteria match.
 */
export function parseAgentMessage(text: string, messageId?: string): ParsedCard[] {
    if (!text) return [];

    const cards: ParsedCard[] = [];
    const lower = text.toLowerCase();
    const idPrefix = messageId || `card_${Date.now()}`;

    // 1. ACTION CHOICE BUTTONS DETECTION
    // Detect when agent offers choices between opening a form or continuing chat
    const isFormOrChatPrompt = 
        (lower.includes('form') && lower.includes('chat')) ||
        lower.includes('fill out a patient form') ||
        lower.includes('intake form or would you prefer to continue chatting') ||
        lower.includes('fill the details') ||
        lower.includes('would you like to open the form');

    if (isFormOrChatPrompt) {
        cards.push({
            id: `${idPrefix}_action_choice`,
            type: 'action_choice',
            rawMessage: text,
            data: {
                prompt: 'How would you like to proceed with your intake?',
                primaryAction: {
                    label: 'Open Patient Form',
                    actionKey: 'open_patient_form'
                },
                secondaryAction: {
                    label: 'Continue Chatting with Aura',
                    actionKey: 'continue_chatting'
                }
            } as ActionChoiceCardData
        });
    }

    // 2. CLINICAL TRIAGE & INTAKE CARD
    const isTriageIntent = 
        lower.includes('triage') ||
        lower.includes('clinical intake') ||
        lower.includes('symptom summary') ||
        lower.includes('nurse review') ||
        lower.includes('escalated to a nurse') ||
        /TRG-[A-Za-z0-9]+/i.test(text);

    if (isTriageIntent) {
        const rawRef = extractReferenceId(text) || `TRG-${Math.random().toString(16).substring(2, 10).toUpperCase()}`;
        const cleanRef = rawRef.startsWith('TRG-') ? rawRef : `TRG-${rawRef}`;

        let urgency: 'Low' | 'Moderate' | 'Immediate Nurse Review' = 'Moderate';
        if (lower.includes('immediate') || lower.includes('emergency') || lower.includes('severe') || lower.includes('critical') || lower.includes('escalat')) {
            urgency = 'Immediate Nurse Review';
        } else if (lower.includes('mild') || lower.includes('low') || lower.includes('routine')) {
            urgency = 'Low';
        }

        cards.push({
            id: `${idPrefix}_triage`,
            type: 'triage',
            rawMessage: text,
            data: {
                referenceId: cleanRef,
                urgency: urgency,
                protocol: urgency === 'Immediate Nurse Review' ? 'Emergency Protocol Delta-1' : 'General Adult Clinical Triage Protocol',
                summary: text.slice(0, 180),
                escalatedToNurse: urgency === 'Immediate Nurse Review' || lower.includes('nurse')
            } as TriageCardData
        });

        // Guardrail: Once triage card is triggered, do NOT generate an appointment card from the same message
        return cards;
    }

    // 3. APPOINTMENT CARD (With Guardrail Check)
    const containsTriageKeywords = TRIAGE_GUARDRAIL_KEYWORDS.some(kw => lower.includes(kw));
    const isAppointmentIntent = 
        (lower.includes('appointment') || lower.includes('booking') || /APT-[A-Za-z0-9]+/i.test(text)) &&
        (lower.includes('confirmed') || lower.includes('scheduled') || lower.includes('booked') || lower.includes('reference'));

    // Guardrail: Never parse an appointment card if text contains triage or symptom keywords
    if (isAppointmentIntent && !containsTriageKeywords) {
        const rawRef = extractReferenceId(text) || `APT-${Date.now().toString().slice(-6)}`;
        const cleanBookingId = rawRef.startsWith('APT-') ? rawRef : `APT-${rawRef}`;

        // Extract Doctor Name
        const docMatch = text.match(/Dr\.?\s+([A-Za-z\s.]+?)(?=\s+(?:on|at|for|in|,|\.|\n|$))/i);
        const doctorName = docMatch ? `Dr. ${docMatch[1].trim()}` : 'Dr. Consultative Physician';

        // Extract Specialty
        let specialty = 'General Medicine';
        const specMatches = ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology', 'Medicine', 'ENT', 'Gynecology'];
        for (const s of specMatches) {
            if (new RegExp(s, 'i').test(text)) {
                specialty = s;
                break;
            }
        }

        // Extract Date / Time or generate readable slot
        const isTelehealth = lower.includes('video') || lower.includes('telehealth') || lower.includes('online');
        const roomOrLink = isTelehealth ? 'https://telehealth.clinic.local/room/aura-meet' : 'Room 304 (Chamber Block B)';

        cards.push({
            id: `${idPrefix}_appointment`,
            type: 'appointment',
            rawMessage: text,
            data: {
                bookingId: cleanBookingId,
                doctorName: doctorName,
                specialty: specialty,
                datetime: 'Scheduled Slot (Confirmed)',
                roomOrLink: roomOrLink,
                isTelehealth: isTelehealth,
                milestones: {
                    scheduled: true,
                    confirmed: true,
                    doctorAssigned: true
                }
            } as AppointmentCardData
        });
    }

    // 4. PRESCRIPTION REFILL CARD
    const isPrescriptionIntent = 
        lower.includes('refill') ||
        lower.includes('prescription') ||
        lower.includes('medication') ||
        /RX-[A-Za-z0-9]+/i.test(text);

    if (isPrescriptionIntent) {
        const rawRef = extractReferenceId(text) || `RX-${Math.floor(100000 + Math.random() * 900000)}`;
        const cleanRef = rawRef.startsWith('RX-') ? rawRef : `RX-${rawRef}`;

        // Medication extraction
        const medMatch = text.match(/(?:medication|refill|drug|tablet|capsule)\s*(?:for\s*)?([A-Za-z0-9\s-]+?)(?=\s+(?:at|\d+mg|daily|pharmacy|,|\.|$))/i);
        const medication = medMatch ? medMatch[1].trim() : 'Prescribed Medication';

        cards.push({
            id: `${idPrefix}_prescription`,
            type: 'prescription',
            rawMessage: text,
            data: {
                refillId: cleanRef,
                medication: medication,
                dosage: 'As prescribed by physician',
                pharmacy: 'Central Hospital Pharmacy (Counter 2)',
                estimatedReady: 'Within 2 Hours'
            } as PrescriptionCardData
        });
    }

    return cards;
}


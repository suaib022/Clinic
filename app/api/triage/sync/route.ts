import { NextRequest, NextResponse } from 'next/server';
import { syncConversationSession } from '@/lib/chat/syncSession';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { conversation_id, intake_id } = body;

        if (!conversation_id) {
            return NextResponse.json(
                { success: false, error: 'conversation_id is required' },
                { status: 400 }
            );
        }

        const result = await syncConversationSession(conversation_id, intake_id);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('API /api/triage/sync error:', err);
        return NextResponse.json(
            { success: false, error: err?.message || 'Server error syncing triage session' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const conversation_id = searchParams.get('conversation_id');
    const intake_id = searchParams.get('intake_id') || undefined;

    if (!conversation_id) {
        return NextResponse.json(
            { success: false, error: 'conversation_id parameter is required' },
            { status: 400 }
        );
    }

    const result = await syncConversationSession(conversation_id, intake_id);
    return NextResponse.json(result);
}


import { NextResponse } from 'next/server';
import { processQueue } from '@/lib/extraction/processRecord';

export const maxDuration = 300;

/**
 * POST /api/extraction/run
 * Retry sweep for queued/failed extractions. Call from a cron (n8n, Supabase pg_cron, etc.)
 * with header: Authorization: Bearer <EXTRACTION_CRON_SECRET>
 */
export async function POST(request: Request) {
    const secret = process.env.EXTRACTION_CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const results = await processQueue();
    return NextResponse.json({ processed: results.length, results });
}

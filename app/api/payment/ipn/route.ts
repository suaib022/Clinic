import { NextRequest, NextResponse } from 'next/server';
import { handlePaymentSuccess } from '@/lib/payment/sslcommerz';

export async function POST(req: NextRequest) {
    try {
        let payload: Record<string, any> = {};
        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            formData.forEach((val, key) => {
                payload[key] = typeof val === 'string' ? val : val.name;
            });
        } else if (contentType.includes('application/json')) {
            payload = await req.json();
        }

        console.log('[SSLCommerz IPN] Received notification for tran_id:', payload.tran_id);

        if (payload.status === 'VALID' || payload.status === 'VALIDATED') {
            await handlePaymentSuccess(payload);
        }

        return NextResponse.json({ status: 'ok', received: true });
    } catch (err: any) {
        console.error('[SSLCommerz IPN] Error handling IPN notification:', err);
        return NextResponse.json({ status: 'error', message: err?.message }, { status: 500 });
    }
}

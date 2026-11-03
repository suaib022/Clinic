import { NextRequest, NextResponse } from 'next/server';
import { handlePaymentSuccess } from '@/lib/payment/sslcommerz';

async function parsePayload(req: NextRequest): Promise<Record<string, any>> {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const obj: Record<string, any> = {};
        formData.forEach((val, key) => {
            obj[key] = typeof val === 'string' ? val : val.name;
        });
        return obj;
    } else if (contentType.includes('application/json')) {
        return await req.json();
    } else {
        // Fallback: check searchParams
        const obj: Record<string, any> = {};
        req.nextUrl.searchParams.forEach((val, key) => {
            obj[key] = val;
        });
        return obj;
    }
}

export async function POST(req: NextRequest) {
    try {
        const payload = await parsePayload(req);
        console.log('[SSLCommerz Success] Received payload for tran_id:', payload.tran_id);

        const result = await handlePaymentSuccess(payload);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
        const redirectUrl = new URL('/appointment/confirmation', appUrl);
        if (result.appointmentId) {
            redirectUrl.searchParams.set('appointment_id', result.appointmentId);
        }
        if (result.tran_id) {
            redirectUrl.searchParams.set('tran_id', result.tran_id);
        }

        // Use 303 See Other to ensure browser changes POST into a GET request
        return NextResponse.redirect(redirectUrl.toString(), 303);
    } catch (err: any) {
        console.error('[SSLCommerz Success] Error processing success callback:', err);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
        const failUrl = new URL('/appointment/payment-failed', appUrl);
        failUrl.searchParams.set('error', err?.message || 'Error confirming payment');
        return NextResponse.redirect(failUrl.toString(), 303);
    }
}

export async function GET(req: NextRequest) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUrl = new URL('/appointment/confirmation', appUrl);
    req.nextUrl.searchParams.forEach((val, key) => {
        redirectUrl.searchParams.set(key, val);
    });
    return NextResponse.redirect(redirectUrl.toString(), 303);
}

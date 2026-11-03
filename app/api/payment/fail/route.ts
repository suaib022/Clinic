import { NextRequest, NextResponse } from 'next/server';
import { handlePaymentFailure } from '@/lib/payment/sslcommerz';

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
        console.warn('[SSLCommerz Fail] Payment failed for tran_id:', payload.tran_id, 'reason:', payload.error || payload.failedreason);

        const result = await handlePaymentFailure(payload);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
        const redirectUrl = new URL('/appointment/payment-failed', appUrl);
        if (result.appointmentId) {
            redirectUrl.searchParams.set('appointment_id', result.appointmentId);
        }
        if (result.tran_id) {
            redirectUrl.searchParams.set('tran_id', result.tran_id);
        }
        redirectUrl.searchParams.set('error', result.error || 'Payment failed or declined');

        return NextResponse.redirect(redirectUrl.toString(), 303);
    } catch (err: any) {
        console.error('[SSLCommerz Fail] Exception:', err);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
        const redirectUrl = new URL('/appointment/payment-failed', appUrl);
        redirectUrl.searchParams.set('error', err?.message || 'Payment failed');
        return NextResponse.redirect(redirectUrl.toString(), 303);
    }
}

export async function GET(req: NextRequest) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUrl = new URL('/appointment/payment-failed', appUrl);
    req.nextUrl.searchParams.forEach((val, key) => {
        redirectUrl.searchParams.set(key, val);
    });
    return NextResponse.redirect(redirectUrl.toString(), 303);
}

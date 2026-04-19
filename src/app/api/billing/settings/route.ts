import { NextRequest, NextResponse } from 'next/server';
import { getBillingSettings, saveBillingSettings } from '@/server/billing';
import type { BillingSettings } from '@/models/billingSchema';

export async function GET() {
  try {
    const settings = await getBillingSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load billing settings' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<BillingSettings>;

    const settings: BillingSettings = {
      admissionFeeAmount: Number(body.admissionFeeAmount || 0),
      parentPortalYearlyFeeAmount: Number(body.parentPortalYearlyFeeAmount || 0),
      currency: 'AUD',
      invoiceDueDays: Number(body.invoiceDueDays || 7),
      reminderDaysBeforeDue: Array.isArray(body.reminderDaysBeforeDue)
        ? body.reminderDaysBeforeDue.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [3, 1],
    };

    const supportEmail = typeof body.supportEmail === 'string' ? body.supportEmail.trim() : '';
    const supportPhone = typeof body.supportPhone === 'string' ? body.supportPhone.trim() : '';

    if (supportEmail) {
      settings.supportEmail = supportEmail;
    }

    if (supportPhone) {
      settings.supportPhone = supportPhone;
    }

    const saved = await saveBillingSettings(settings, 'admin-portal');
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save billing settings' },
      { status: 500 },
    );
  }
}

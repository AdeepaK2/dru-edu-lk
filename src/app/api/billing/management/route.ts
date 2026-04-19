import { NextRequest, NextResponse } from 'next/server';
import {
  getBillingManagementOverview,
  markParentPortalPaidOffline,
} from '@/server/billing';

export async function GET() {
  try {
    const overview = await getBillingManagementOverview();
    return NextResponse.json({ success: true, data: overview });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load billing management data' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '').trim();

    if (action !== 'mark_paid_offline') {
      return NextResponse.json(
        { success: false, error: 'Unsupported billing management action' },
        { status: 400 },
      );
    }

    const parentEmail = String(body.parentEmail || '').trim();
    if (!parentEmail) {
      return NextResponse.json(
        { success: false, error: 'parentEmail is required' },
        { status: 400 },
      );
    }

    const result = await markParentPortalPaidOffline(parentEmail, {
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      processedBy: typeof body.processedBy === 'string' ? body.processedBy : 'admin',
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Parent portal fee marked as paid offline',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update billing status' },
      { status: 500 },
    );
  }
}

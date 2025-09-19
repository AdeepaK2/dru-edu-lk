import { NextRequest, NextResponse } from 'next/server';
import { SheetManagerService } from '@/apiservices/sheetManagerService';

export async function GET() {
  try {
    const allocations = await SheetManagerService.getAllocations();
    return NextResponse.json({ success: true, allocations });
  } catch (error) {
    console.error('Error fetching allocations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch allocations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, templateName, classId, className, title, description, teacherId, teacherEmail, studentCount } = body;

    if (!templateId || !classId || !title || !teacherId || !teacherEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const allocationId = await SheetManagerService.createAllocation({
      templateId,
      templateName: templateName || 'Unknown Template',
      classId,
      className: className || 'Unknown Class',
      title,
      description: description || '',
      teacherId,
      teacherEmail,
      studentCount: studentCount || 0
    });

    return NextResponse.json({ success: true, allocationId });
  } catch (error) {
    console.error('Error creating allocation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create allocation' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { allocationId, updates } = body;

    if (!allocationId) {
      return NextResponse.json(
        { success: false, error: 'Missing allocation ID' },
        { status: 400 }
      );
    }

    await SheetManagerService.updateAllocation(allocationId, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating allocation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update allocation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const allocationId = searchParams.get('id');

    if (!allocationId) {
      return NextResponse.json(
        { success: false, error: 'Missing allocation ID' },
        { status: 400 }
      );
    }

    await SheetManagerService.deleteAllocation(allocationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting allocation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete allocation' },
      { status: 500 }
    );
  }
}
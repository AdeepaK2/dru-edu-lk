import { NextRequest, NextResponse } from 'next/server';
import { SheetManagerService } from '@/apiservices/sheetManagerService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const allocationId = searchParams.get('allocationId');
    const studentId = searchParams.get('studentId');

    if (allocationId) {
      const studentSheets = await SheetManagerService.getStudentSheets(allocationId);
      return NextResponse.json({ success: true, studentSheets });
    } else if (studentId) {
      const studentSheets = await SheetManagerService.getStudentSheetsByStudentId(studentId);
      return NextResponse.json({ success: true, studentSheets });
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing allocationId or studentId parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error fetching student sheets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch student sheets' },
      { status: 500 }
    );
  }
}
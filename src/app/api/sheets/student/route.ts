import { NextRequest, NextResponse } from 'next/server';
import { SheetManagerService } from '@/apiservices/sheetManagerService';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get('sheetId');

    if (!sheetId) {
      return NextResponse.json(
        { error: 'Sheet ID is required' },
        { status: 400 }
      );
    }

    await SheetManagerService.deleteStudentSheet(sheetId);

    return NextResponse.json({ 
      success: true, 
      message: 'Student sheet deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting student sheet:', error);
    return NextResponse.json(
      { error: 'Failed to delete student sheet' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { SheetManagerService } from '@/apiservices/sheetManagerService';

export async function GET() {
  try {
    console.log('GET /api/sheets/templates - Starting request');
    const templates = await SheetManagerService.getTemplates();
    console.log('GET /api/sheets/templates - Templates fetched:', templates.length, 'templates');
    console.log('GET /api/sheets/templates - First template:', templates[0]);
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, fileName, filePath, uploadedBy } = body;

    if (!name || !fileName || !filePath || !uploadedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const templateId = await SheetManagerService.createTemplate({
      name,
      description: description || '',
      fileName,
      filePath,
      uploadedBy
    });

    return NextResponse.json({ success: true, templateId });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
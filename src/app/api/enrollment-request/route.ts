import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { 
  enrollmentRequestSchema, 
  enrollmentRequestUpdateSchema,
  EnrollmentRequestDocument,
  convertEnrollmentRequestDocument 
} from '@/models/enrollmentRequestSchema';
import {
  createEnrollmentApprovalInvoice,
  finalizeEnrollmentWithoutPayment,
} from '@/server/billing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the enrollment request data
    const validatedData = enrollmentRequestSchema.parse(body);
    
    // Create enrollment request document
    const enrollmentRequestData = {
      ...validatedData,
      status: 'Pending' as const,
      notificationSent: false,
      createdAt: firebaseAdmin.admin.firestore.Timestamp.now(),
      updatedAt: firebaseAdmin.admin.firestore.Timestamp.now(),
    };
    
    // Add to Firestore
    const docRef = await firebaseAdmin.db.collection('enrollmentRequests').add(enrollmentRequestData);
    
    // Return the created enrollment request with ID
    const createdRequest = {
      id: docRef.id,
      ...enrollmentRequestData,
    };
    
    return NextResponse.json(createdRequest, { status: 201 });
  } catch (error: any) {
    console.error('Error creating enrollment request:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create enrollment request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const studentEmail = searchParams.get('studentEmail');
    
    let enrollmentQuery = firebaseAdmin.db.collection('enrollmentRequests')
      .orderBy('createdAt', 'desc');
    
    // Filter by status if provided
    if (status && status !== 'all') {
      enrollmentQuery = firebaseAdmin.db.collection('enrollmentRequests')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc');
    }
    
    // Filter by student email if provided
    if (studentEmail) {
      enrollmentQuery = firebaseAdmin.db.collection('enrollmentRequests')
        .where('student.email', '==', studentEmail)
        .orderBy('createdAt', 'desc');
    }
    
    const querySnapshot = await enrollmentQuery.get();
    const enrollmentRequests = querySnapshot.docs.map(doc => {
      const data = doc.data() as Omit<EnrollmentRequestDocument, 'id'>;
      return convertEnrollmentRequestDocument({
        id: doc.id,
        ...data,
      });
    });
    
    return NextResponse.json(enrollmentRequests);
  } catch (error) {
    console.error('Error fetching enrollment requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrollment requests' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Enrollment request ID is required' },
        { status: 400 }
      );
    }
    
    // Validate update data
    const validatedUpdateData = enrollmentRequestUpdateSchema.parse(updateData);

    // Keep enrollment approval on the legacy no-payment path by default.
    // Turn on payment-gated approvals only when explicitly enabled.
    const paymentFlowEnabled = process.env.ENROLLMENT_APPROVAL_USE_PAYMENT_FLOW === 'true';

    // Approvals always run through server-side finalization flow so Auth user creation,
    // student document creation, enrollment creation, and welcome email stay in sync.
    if (validatedUpdateData.status === 'Approved') {
      const adminMetadata: Record<string, unknown> = {};
      if (validatedUpdateData.adminNotes !== undefined) {
        adminMetadata.adminNotes = validatedUpdateData.adminNotes;
      }
      if (validatedUpdateData.processedBy !== undefined) {
        adminMetadata.processedBy = validatedUpdateData.processedBy;
      }

      if (!paymentFlowEnabled) {
        const finalized = await finalizeEnrollmentWithoutPayment(id);

        if (Object.keys(adminMetadata).length > 0) {
          await firebaseAdmin.db.collection('enrollmentRequests').doc(id).update({
            ...adminMetadata,
            updatedAt: firebaseAdmin.admin.firestore.Timestamp.now(),
          });
        }

        return NextResponse.json({
          message: 'Enrollment approved successfully',
          id,
          status: 'Approved',
          requiresPayment: false,
          paymentFlowEnabled: false,
          studentId: finalized.studentId,
        });
      }

      const billingResult = await createEnrollmentApprovalInvoice(
        id,
        request.nextUrl.origin,
      );

      if (!billingResult.requiresPayment) {
        const finalized = await finalizeEnrollmentWithoutPayment(id);

        if (Object.keys(adminMetadata).length > 0) {
          await firebaseAdmin.db.collection('enrollmentRequests').doc(id).update({
            ...adminMetadata,
            updatedAt: firebaseAdmin.admin.firestore.Timestamp.now(),
          });
        }

        return NextResponse.json({
          message: 'Enrollment approved successfully',
          id,
          status: 'Approved',
          requiresPayment: false,
          paymentFlowEnabled: true,
          studentId: finalized.studentId,
        });
      }

      if (Object.keys(adminMetadata).length > 0) {
        await firebaseAdmin.db.collection('enrollmentRequests').doc(id).update({
          ...adminMetadata,
          updatedAt: firebaseAdmin.admin.firestore.Timestamp.now(),
        });
      }

      return NextResponse.json({
        message: 'Enrollment marked as awaiting payment',
        id,
        status: 'Awaiting Payment',
        requiresPayment: true,
        paymentFlowEnabled: true,
        invoice: billingResult.invoice ?? null,
      });
    }
    
    // Add timestamp for processing
    const updatePayload: any = {
      ...validatedUpdateData,
      updatedAt: firebaseAdmin.admin.firestore.Timestamp.now(),
    };
    
    // If status is being changed to rejected, add processed timestamp
    if (validatedUpdateData.status === 'Rejected') {
      updatePayload.processedAt = firebaseAdmin.admin.firestore.Timestamp.now();
    }
    
    // Update in Firestore
    await firebaseAdmin.db.collection('enrollmentRequests').doc(id).update(updatePayload);
    
    return NextResponse.json({ 
      message: 'Enrollment request updated successfully',
      id,
      ...updatePayload
    });
  } catch (error: any) {
    console.error('Error updating enrollment request:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update enrollment request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Enrollment request ID is required' },
        { status: 400 }
      );
    }
    
    // Delete from Firestore
    await firebaseAdmin.db.collection('enrollmentRequests').doc(id).delete();
    
    return NextResponse.json({ 
      message: 'Enrollment request deleted successfully',
      id 
    });
  } catch (error) {
    console.error('Error deleting enrollment request:', error);
    return NextResponse.json(
      { error: 'Failed to delete enrollment request' },
      { status: 500 }
    );
  }
}

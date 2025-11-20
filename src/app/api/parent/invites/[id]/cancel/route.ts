import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: inviteId } = await context.params;

    const inviteRef = adminFirestore.collection('parentInvites').doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      );
    }

    const invite = inviteDoc.data();

    if (invite?.inviteStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending invites can be cancelled' },
        { status: 400 }
      );
    }

    await inviteRef.update({
      inviteStatus: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Invite cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling invite:', error);
    return NextResponse.json(
      { error: 'Failed to cancel invite' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { ClassDocument } from '@/models/classSchema';
import { ClassScheduleData, validateClassScheduleData } from '@/models/classScheduleSchema';
import { Timestamp } from 'firebase-admin/firestore';

interface ScheduleRequest {
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  meetingLink?: string;
}

/**
 * GET /api/classes/[classId]/schedule - Get scheduled classes for a specific class
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!classId) {
      return NextResponse.json(
        { error: 'Class ID is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = firebaseAdmin.db
      .collection('classSchedules')
      .where('classId', '==', classId);

    // Add date range filters if provided
    if (from) {
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);
      query = query.where('scheduledDate', '>=', Timestamp.fromDate(fromDate));
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query = query.where('scheduledDate', '<=', Timestamp.fromDate(toDate));
    }

    // Order by date
    query = query.orderBy('scheduledDate', 'asc');

    const schedulesSnapshot = await query.get();
    const schedules = schedulesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps to ISO strings for client
      scheduledDate: doc.data().scheduledDate.toDate().toISOString(),
      createdAt: doc.data().createdAt.toDate().toISOString(),
      updatedAt: doc.data().updatedAt.toDate().toISOString(),
    }));

    return NextResponse.json({ schedules }, { status: 200 });

  } catch (error) {
    console.error('Error fetching class schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/classes/[classId]/schedule - Create a new scheduled class
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const body: ScheduleRequest = await request.json();

    if (!classId) {
      return NextResponse.json(
        { error: 'Class ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.date || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: 'Date, start time, and end time are required' },
        { status: 400 }
      );
    }

    // Get class details
    const classDoc = await firebaseAdmin.db
      .collection('classes')
      .doc(classId)
      .get();

    if (!classDoc.exists) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    const classData = classDoc.data() as ClassDocument;

    // Get teacher info if available
    let teacherName = '';
    if (classData.teacherId) {
      const teacherDoc = await firebaseAdmin.db
        .collection('teachers')
        .doc(classData.teacherId)
        .get();
      
      if (teacherDoc.exists) {
        teacherName = teacherDoc.data()?.name || '';
      }
    }

    // Get subject name
    let subjectName = classData.subject; // fallback to subject field
    try {
      const subjectDoc = await firebaseAdmin.db
        .collection('subjects')
        .doc(classData.subjectId)
        .get();
      
      if (subjectDoc.exists) {
        subjectName = subjectDoc.data()?.name || classData.subject;
      }
    } catch (error) {
      console.warn('Could not fetch subject name:', error);
    }

    // Get enrolled students with details
    const enrollmentsSnapshot = await firebaseAdmin.db
      .collection('enrollments')
      .where('classId', '==', classId)
      .where('status', '==', 'active')
      .get();

    const studentDetails = [];
    for (const enrollment of enrollmentsSnapshot.docs) {
      const enrollmentData = enrollment.data();
      try {
        const studentDoc = await firebaseAdmin.db
          .collection('students')
          .doc(enrollmentData.studentId)
          .get();
        
        if (studentDoc.exists) {
          const studentData = studentDoc.data();
          if (studentData) {
            studentDetails.push({
              studentId: enrollmentData.studentId,
              studentName: studentData.name || 'Unknown',
              studentEmail: studentData.email || ''
            });
          }
        }
      } catch (error) {
        console.warn(`Could not fetch student ${enrollmentData.studentId}:`, error);
      }
    }

    // Check for existing schedule on the same date
    const scheduledDate = new Date(body.date);
    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingSchedule = await firebaseAdmin.db
      .collection('classSchedules')
      .where('classId', '==', classId)
      .where('scheduledDate', '>=', Timestamp.fromDate(startOfDay))
      .where('scheduledDate', '<=', Timestamp.fromDate(endOfDay))
      .get();

    if (!existingSchedule.empty) {
      return NextResponse.json(
        { error: 'A class is already scheduled for this date' },
        { status: 409 }
      );
    }

    // Create schedule data
    const now = new Date();
    const scheduleData: ClassScheduleData = {
      classId,
      className: classData.name,
      teacherId: classData.teacherId || '',
      teacherName: teacherName,
      subjectId: classData.subjectId,
      subjectName: subjectName,
      scheduledDate: scheduledDate,
      startTime: body.startTime,
      endTime: body.endTime,
      duration: calculateDuration(body.startTime, body.endTime),
      scheduleType: 'extra', // Manual schedules are extra classes
      mode: 'physical',
      status: 'scheduled',
      attendance: {
        totalStudents: studentDetails.length,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        attendanceRate: 0,
        students: studentDetails.map(student => ({
          studentId: student.studentId,
          studentName: student.studentName,
          studentEmail: student.studentEmail,
          status: 'absent', // default to absent, not_marked doesn't exist in schema
          markedAt: undefined,
          notes: '',
          markedBy: undefined
        })),
        lastUpdatedAt: undefined,
        lastUpdatedBy: undefined
      },
      topic: body.notes || '',
      description: body.notes || '',
      materials: [],
      isRecurring: false,
      createdAt: now,
      updatedAt: now,
      createdBy: 'manual-schedule',
      updatedBy: undefined
    };

    // Validate the data
    const validatedData = validateClassScheduleData(scheduleData);

    // Convert dates to Firestore timestamps for storage
    const firestoreData = {
      ...validatedData,
      scheduledDate: Timestamp.fromDate(validatedData.scheduledDate),
      createdAt: Timestamp.fromDate(validatedData.createdAt),
      updatedAt: Timestamp.fromDate(validatedData.updatedAt),
      attendance: {
        ...validatedData.attendance,
        lastUpdatedAt: validatedData.attendance.lastUpdatedAt 
          ? Timestamp.fromDate(validatedData.attendance.lastUpdatedAt)
          : undefined,
        students: validatedData.attendance.students.map(student => ({
          ...student,
          markedAt: student.markedAt ? Timestamp.fromDate(student.markedAt) : undefined,
        }))
      }
    };

    // Save to Firestore
    const docRef = await firebaseAdmin.db
      .collection('classSchedules')
      .add(firestoreData);

    return NextResponse.json(
      { 
        id: docRef.id,
        message: 'Class scheduled successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating class schedule:', error);
    return NextResponse.json(
      { error: 'Failed to schedule class' },
      { status: 500 }
    );
  }
}

/**
 * Calculate duration in minutes between start and end time
 */
function calculateDuration(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes - startTotalMinutes;
}

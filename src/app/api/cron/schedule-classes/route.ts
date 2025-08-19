import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { ClassDocument } from '@/models/classSchema';
import { ClassScheduleData, validateClassScheduleData } from '@/models/classScheduleSchema';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface ScheduleJob {
  classId: string;
  className: string;
  teacherId?: string;
  teacherName?: string;
  subjectId: string;
  subjectName: string;
  day: string;
  startTime: string;
  endTime: string;
  targetDate: Date;
  duration: number;
}

/**
 * Cron job to automatically schedule regular classes
 * Runs every 24 hours to check and schedule classes for the next week
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🕐 Starting class scheduling cron job...');
    
    // Get all active classes
    const classesSnapshot = await firebaseAdmin.db
      .collection('classes')
      .where('status', '==', 'Active')
      .get();
    
    if (classesSnapshot.empty) {
      console.log('📝 No active classes found');
      return NextResponse.json({ 
        success: true, 
        message: 'No active classes to schedule',
        scheduled: 0 
      });
    }

    const classes = classesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    })) as ClassDocument[];

    console.log(`📚 Found ${classes.length} active classes`);
    
    // Debug: Log all class IDs
    classes.forEach(cls => {
      console.log(`🎯 Class Debug:`, {
        firestoreId: cls.id,
        classId: cls.classId,
        name: cls.name,
        usingForSchedule: cls.id // This is what gets used as classId in schedules
      });
    });

    // Generate schedule jobs for the next 7 days
    const scheduleJobs = await generateScheduleJobs(classes);
    console.log(`🗓️ Generated ${scheduleJobs.length} potential schedule jobs`);

    // Filter out already scheduled classes
    const newSchedules = await filterExistingSchedules(scheduleJobs);
    console.log(`✨ Found ${newSchedules.length} new schedules to create`);

    // Create the new schedules
    let scheduledCount = 0;
    const errors: string[] = [];

    for (const job of newSchedules) {
      try {
        await createClassSchedule(job);
        scheduledCount++;
        console.log(`✅ Scheduled: ${job.className} on ${job.targetDate.toDateString()} at ${job.startTime}`);
      } catch (error) {
        const errorMsg = `Failed to schedule ${job.className}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 Cron job completed. Scheduled ${scheduledCount} classes`);

    return NextResponse.json({
      success: true,
      message: `Successfully scheduled ${scheduledCount} classes`,
      scheduled: scheduledCount,
      errors: errors.length > 0 ? errors : undefined,
      totalClassesChecked: classes.length,
      potentialSchedules: scheduleJobs.length,
      newSchedules: newSchedules.length
    });

  } catch (error) {
    console.error('💥 Cron job failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        scheduled: 0
      },
      { status: 500 }
    );
  }
}

/**
 * Generate schedule jobs for all classes for the next 7 days
 */
async function generateScheduleJobs(classes: ClassDocument[]): Promise<ScheduleJob[]> {
  const scheduleJobs: ScheduleJob[] = [];
  const today = new Date();
  
  // Check next 7 days
  for (let i = 1; i <= 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });

    for (const classDoc of classes) {
      // Skip classes without teacher assigned
      if (!classDoc.teacherId) {
        continue;
      }

      // Check if class has schedule for this day
      const daySchedule = classDoc.schedule.find(slot => 
        slot.day.toLowerCase() === dayName.toLowerCase()
      );

      if (daySchedule) {
        // Get teacher name (optional, for better logging)
        let teacherName = 'Unknown Teacher';
        try {
          const teacherDoc = await firebaseAdmin.db
            .collection('teachers')
            .doc(classDoc.teacherId)
            .get();
          if (teacherDoc.exists) {
            teacherName = teacherDoc.data()?.name || teacherName;
          }
        } catch (error) {
          console.warn(`Could not fetch teacher name for ${classDoc.teacherId}`);
        }

        // Calculate duration
        const duration = calculateDuration(daySchedule.startTime, daySchedule.endTime);

        scheduleJobs.push({
          classId: classDoc.id,
          className: classDoc.name,
          teacherId: classDoc.teacherId,
          teacherName,
          subjectId: classDoc.subjectId,
          subjectName: classDoc.subject,
          day: dayName,
          startTime: daySchedule.startTime,
          endTime: daySchedule.endTime,
          targetDate,
          duration
        });
      }
    }
  }

  return scheduleJobs;
}

/**
 * Filter out schedules that already exist
 */
async function filterExistingSchedules(scheduleJobs: ScheduleJob[]): Promise<ScheduleJob[]> {
  const newSchedules: ScheduleJob[] = [];

  for (const job of scheduleJobs) {
    const exists = await checkScheduleExists(job.classId, job.targetDate);
    if (!exists) {
      newSchedules.push(job);
    }
  }

  return newSchedules;
}

/**
 * Check if a schedule already exists for a class on a specific date
 */
async function checkScheduleExists(classId: string, date: Date): Promise<boolean> {
  try {
    // Create date range for the entire day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingSnapshot = await firebaseAdmin.db
      .collection('classSchedules')
      .where('classId', '==', classId)
      .where('scheduledDate', '>=', Timestamp.fromDate(startOfDay))
      .where('scheduledDate', '<=', Timestamp.fromDate(endOfDay))
      .get();

    return !existingSnapshot.empty;
  } catch (error) {
    console.warn(`Error checking existing schedule for class ${classId}:`, error);
    // In case of error, assume it doesn't exist to avoid missing schedules
    return false;
  }
}

/**
 * Create a new class schedule
 */
async function createClassSchedule(job: ScheduleJob): Promise<void> {
  const now = new Date();
  
  const scheduleData: ClassScheduleData = {
    classId: job.classId,
    className: job.className,
    subjectId: job.subjectId,
    subjectName: job.subjectName,
    teacherId: job.teacherId || '',
    teacherName: job.teacherName || 'Unknown Teacher',
    
    // Schedule details
    scheduledDate: job.targetDate,
    startTime: job.startTime,
    endTime: job.endTime,
    duration: job.duration,
    
    // Default values for regular classes
    scheduleType: 'regular',
    mode: 'physical', // Default to physical, can be updated later
    location: `Center Location`, // Default location, can be updated
    
    // Empty attendance initially
    attendance: {
      totalStudents: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      attendanceRate: 0,
      students: [],
    },
    
    // Optional fields
    topic: `Regular ${job.subjectName} class`,
    description: `Regular ${job.subjectName} class`,
    materials: [],
    
    // Status and metadata
    status: 'scheduled',
    isRecurring: true,
    recurringPattern: 'weekly',
    
    // Timestamps
    createdAt: now,
    updatedAt: now,
    createdBy: 'system-cron',
    updatedBy: 'system-cron',
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
      totalStudents: validatedData.attendance.totalStudents,
      presentCount: validatedData.attendance.presentCount,
      absentCount: validatedData.attendance.absentCount,
      lateCount: validatedData.attendance.lateCount,
      attendanceRate: validatedData.attendance.attendanceRate,
      students: validatedData.attendance.students.map(student => ({
        ...student,
        markedAt: student.markedAt ? Timestamp.fromDate(student.markedAt) : null,
      }))
    }
  };

  // Remove undefined values recursively
  const cleanData = removeUndefinedValues(firestoreData);

  // Save to Firestore
  await firebaseAdmin.db
    .collection('classSchedules')
    .add(cleanData);
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

/**
 * Remove undefined values from an object recursively
 */
function removeUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

// Export for Vercel cron jobs
export const dynamic = 'force-dynamic';

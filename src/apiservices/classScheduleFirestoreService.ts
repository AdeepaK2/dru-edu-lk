import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  Timestamp,
  DocumentData,
  QuerySnapshot,
  limit
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { 
  ClassScheduleData, 
  ClassScheduleDocument, 
  ClassScheduleUpdateData,
  classScheduleSchema,
  StudentAttendanceData
} from '@/models/classScheduleSchema';
import { ClassDocument } from '@/models/classSchema';

const COLLECTION_NAME = 'classSchedules';

export class ClassScheduleFirestoreService {
  private static collectionRef = collection(firestore, COLLECTION_NAME);

  /**
   * Create a new class schedule
   */
  static async createSchedule(scheduleData: Partial<ClassScheduleData>): Promise<string> {
    try {
      // Prepare the document data with defaults - only include defined fields
      const now = new Date();
      const documentData: any = {
        classId: scheduleData.classId || '',
        className: scheduleData.className || '',
        subjectId: scheduleData.subjectId || '',
        subjectName: scheduleData.subjectName || '',
        teacherId: scheduleData.teacherId || '',
        teacherName: scheduleData.teacherName || '',
        scheduledDate: scheduleData.scheduledDate ? Timestamp.fromDate(scheduleData.scheduledDate) : Timestamp.now(),
        startTime: scheduleData.startTime || '09:00',
        endTime: scheduleData.endTime || '10:00',
        duration: scheduleData.duration || 60,
        scheduleType: scheduleData.scheduleType || 'regular',
        mode: scheduleData.mode || 'physical',
        attendance: {
          totalStudents: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          attendanceRate: 0,
          students: [],
          ...scheduleData.attendance
        },
        materials: scheduleData.materials || [],
        status: scheduleData.status || 'scheduled',
        isRecurring: scheduleData.isRecurring || false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: scheduleData.createdBy || 'system',
        updatedBy: scheduleData.updatedBy || 'system'
      };

      // Only add optional fields if they have values
      if (scheduleData.location && scheduleData.location.trim()) {
        documentData.location = scheduleData.location;
      }
      if (scheduleData.zoomUrl && scheduleData.zoomUrl.trim()) {
        documentData.zoomUrl = scheduleData.zoomUrl;
      }
      if (scheduleData.zoomMeetingId && scheduleData.zoomMeetingId.trim()) {
        documentData.zoomMeetingId = scheduleData.zoomMeetingId;
      }
      if (scheduleData.zoomPassword && scheduleData.zoomPassword.trim()) {
        documentData.zoomPassword = scheduleData.zoomPassword;
      }
      if (scheduleData.topic && scheduleData.topic.trim()) {
        documentData.topic = scheduleData.topic;
      }
      if (scheduleData.description && scheduleData.description.trim()) {
        documentData.description = scheduleData.description;
      }
      if (scheduleData.recurringPattern && scheduleData.recurringPattern.trim()) {
        documentData.recurringPattern = scheduleData.recurringPattern;
      }

      const docRef = await addDoc(this.collectionRef, documentData);
      console.log('✅ Schedule created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating schedule:', error);
      throw new Error(`Failed to create schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Auto-schedule classes for a specific class based on its weekly schedule
   */
  static async autoScheduleForClass(classData: ClassDocument, daysAhead: number = 7): Promise<number> {
    try {
      if (!classData.schedule || classData.schedule.length === 0) {
        throw new Error('No schedule configured for this class');
      }

      let scheduledCount = 0;
      const today = new Date();
      
      // Get existing schedules for this class to avoid duplicates
      const existingSchedules = await this.getSchedulesByClassId(classData.id, today, daysAhead + 1);
      
      // Check each day starting from today (i=0) for the next 'daysAhead' days
      for (let i = 0; i <= daysAhead; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });

        // Find matching schedule for this day
        const daySchedule = classData.schedule.find(slot => 
          slot.day.toLowerCase() === dayName.toLowerCase()
        );

        if (daySchedule) {
          // If scheduling for today, check if class is at least 3 hours away
          if (i === 0) {
            const now = new Date();
            const [startHours, startMinutes] = daySchedule.startTime.split(':').map(Number);
            const classStartTime = new Date(targetDate);
            classStartTime.setHours(startHours, startMinutes, 0, 0);
            
            const timeDifference = classStartTime.getTime() - now.getTime();
            const hoursUntilClass = timeDifference / (1000 * 60 * 60); // Convert to hours
            
            if (hoursUntilClass < 3) {
              console.log(`⏭️ Skipping today's class - only ${hoursUntilClass.toFixed(1)} hours remaining (need at least 3 hours)`);
              continue;
            }
          }
          // Check if already scheduled for this date
          const alreadyScheduled = existingSchedules.some(schedule => {
            const scheduleDate = schedule.scheduledDate instanceof Timestamp 
              ? schedule.scheduledDate.toDate() 
              : schedule.scheduledDate;
            return scheduleDate.toDateString() === targetDate.toDateString();
          });

          if (alreadyScheduled) {
            console.log(`⏭️ Skipping ${dayName} ${targetDate.toDateString()} - already scheduled`);
            continue;
          }

          // Calculate duration in minutes
          const [startHours, startMinutes] = daySchedule.startTime.split(':').map(Number);
          const [endHours, endMinutes] = daySchedule.endTime.split(':').map(Number);
          const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);

          // Create schedule (only include defined fields for physical classes)
          await this.createSchedule({
            classId: classData.id,
            className: classData.name,
            subjectId: classData.subjectId,
            subjectName: classData.subject,
            teacherId: classData.teacherId || 'default-teacher',
            teacherName: 'Teacher Name', // TODO: Fetch actual teacher name
            scheduledDate: targetDate,
            startTime: daySchedule.startTime,
            endTime: daySchedule.endTime,
            duration: duration,
            scheduleType: 'regular',
            mode: 'physical',
            status: 'scheduled',
            topic: `Regular ${classData.subject} class`,
            description: `Regular ${classData.subject} class`,
            location: 'Center Location',
            isRecurring: true,
            recurringPattern: 'weekly',
            createdBy: 'system-auto-schedule',
            updatedBy: 'system-auto-schedule'
            // Note: No Zoom fields for physical classes
          });

          scheduledCount++;
          console.log(`✅ Auto-scheduled: ${classData.name} on ${targetDate.toDateString()} at ${daySchedule.startTime}`);
        }
      }

      return scheduledCount;
    } catch (error) {
      console.error('❌ Error auto-scheduling for class:', error);
      throw new Error(`Failed to auto-schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a manual/extra schedule
   */
  static async createExtraSchedule(
    classData: ClassDocument,
    date: Date,
    startTime: string,
    endTime: string,
    notes?: string,
    mode: 'physical' | 'online' = 'physical',
    location?: string,
    zoomUrl?: string,
    zoomMeetingId?: string,
    zoomPassword?: string
  ): Promise<string> {
    try {
      // Validate time format
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      if (startHours * 60 + startMinutes >= endHours * 60 + endMinutes) {
        throw new Error('End time must be after start time');
      }

      // Multiple classes per day are now allowed - no duplicate check needed
      // Log if there are existing classes for reference
      const existingSchedules = await this.getSchedulesByDate(classData.id, date);
      if (existingSchedules.length > 0) {
        console.log(`📅 Note: ${existingSchedules.length} class(es) already scheduled for ${date.toDateString()}. Adding additional class.`);
      }

      const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);

      // Prepare schedule data
      const scheduleData: any = {
        classId: classData.id,
        className: classData.name,
        subjectId: classData.subjectId,
        subjectName: classData.subject,
        teacherId: classData.teacherId || 'default-teacher',
        teacherName: 'Teacher Name', // TODO: Fetch actual teacher name
        scheduledDate: date,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        scheduleType: 'extra',
        mode: mode,
        status: 'scheduled',
        topic: notes || `Extra ${classData.subject} class`,
        description: notes || `Extra ${classData.subject} class`,
        isRecurring: false,
        createdBy: 'manual-schedule',
        updatedBy: 'manual-schedule'
      };

      // Add location or zoom details based on mode
      if (mode === 'physical') {
        scheduleData.location = location || 'Center Location';
      } else if (mode === 'online') {
        if (zoomUrl) scheduleData.zoomUrl = zoomUrl;
        if (zoomMeetingId) scheduleData.zoomMeetingId = zoomMeetingId;
        if (zoomPassword) scheduleData.zoomPassword = zoomPassword;
      }

      const scheduleId = await this.createSchedule(scheduleData);

      console.log(`✅ Extra schedule created for ${date.toDateString()}`);
      return scheduleId;
    } catch (error) {
      console.error('❌ Error creating extra schedule:', error);
      throw new Error(`Failed to create extra schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get schedules by class ID within a date range
   */
  static async getSchedulesByClassId(
    classId: string, 
    startDate?: Date, 
    daysRange: number = 30
  ): Promise<ClassScheduleDocument[]> {
    try {
      console.log('🔍 Loading scheduled classes for classId:', classId);
      
      // Load schedules from 30 days ago to future to show all in calendar
      const currentDate = startDate || new Date();
      const pastDate = new Date(currentDate);
      pastDate.setDate(currentDate.getDate() - 30); // Go back 30 days
      const futureDate = new Date(currentDate);
      futureDate.setDate(currentDate.getDate() + daysRange);
      
      console.log('📅 Date range:', { from: pastDate, to: futureDate });
      
      // Try compound query first
      let querySnapshot;
      try {
        const q = query(
          this.collectionRef,
          where('classId', '==', classId),
          where('scheduledDate', '>=', Timestamp.fromDate(pastDate)),
          where('scheduledDate', '<=', Timestamp.fromDate(futureDate)),
          orderBy('scheduledDate', 'asc')
        );
        querySnapshot = await getDocs(q);
        console.log('📋 Found documents with compound query:', querySnapshot.size);
      } catch (error) {
        console.warn('⚠️ Compound query failed, using simple query:', error);
        // Fallback to simple query
        const simpleQuery = query(
          this.collectionRef,
          where('classId', '==', classId)
        );
        querySnapshot = await getDocs(simpleQuery);
        console.log('📋 Found documents with simple query:', querySnapshot.size);
      }
      
      // If no results, try client-side filtering from all documents
      if (querySnapshot.size === 0) {
        console.log('🔄 No results from queries, checking all schedules...');
        const allSchedulesRef = collection(firestore, COLLECTION_NAME);
        const allSnapshot = await getDocs(allSchedulesRef);
        
        console.log('📋 Total schedules in database:', allSnapshot.size);
        
        const matchingSchedules: ClassScheduleDocument[] = [];
        allSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.classId === classId) {
            // Safe date conversion
            let scheduleDate: Date;
            try {
              if (data.scheduledDate && typeof data.scheduledDate.toDate === 'function') {
                scheduleDate = data.scheduledDate.toDate();
              } else if (data.scheduledDate instanceof Date) {
                scheduleDate = data.scheduledDate;
              } else if (typeof data.scheduledDate === 'string') {
                scheduleDate = new Date(data.scheduledDate);
              } else if (data.scheduledDate && typeof (data.scheduledDate as any)._seconds === 'number') {
                const rawTimestamp = data.scheduledDate as any;
                scheduleDate = new Date(rawTimestamp._seconds * 1000 + rawTimestamp._nanoseconds / 1000000);
              } else {
                console.warn('⚠️ Invalid scheduledDate format for document:', doc.id, data.scheduledDate);
                return;
              }
            } catch (error) {
              console.error('❌ Error converting scheduledDate for document:', doc.id, error);
              return;
            }
            
            if (scheduleDate >= pastDate && scheduleDate <= futureDate) {
              matchingSchedules.push({
                id: doc.id,
                ...data,
                scheduledDate: data.scheduledDate, // Keep original format
              } as ClassScheduleDocument);
            }
          }
        });
        
        console.log('📋 Found schedules via client-side filtering:', matchingSchedules.length);
        return matchingSchedules.sort((a, b) => {
          const dateA = a.scheduledDate instanceof Timestamp ? a.scheduledDate.toDate() : a.scheduledDate;
          const dateB = b.scheduledDate instanceof Timestamp ? b.scheduledDate.toDate() : b.scheduledDate;
          return dateA.getTime() - dateB.getTime();
        });
      }
      
      const schedules: ClassScheduleDocument[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        schedules.push({
          id: doc.id,
          ...data
        } as ClassScheduleDocument);
      });
      
      console.log('✅ Loaded schedules:', schedules.length);
      return schedules;
    } catch (error) {
      console.error('❌ Error loading scheduled classes:', error);
      throw new Error(`Failed to load schedules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get schedules by specific date
   */
  static async getSchedulesByDate(classId: string, date: Date): Promise<ClassScheduleDocument[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const q = query(
        this.collectionRef,
        where('classId', '==', classId),
        where('scheduledDate', '>=', Timestamp.fromDate(startOfDay)),
        where('scheduledDate', '<=', Timestamp.fromDate(endOfDay))
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClassScheduleDocument));
    } catch (error) {
      console.error('❌ Error getting schedules by date:', error);
      throw new Error(`Failed to get schedules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific schedule by ID
   */
  static async getScheduleById(scheduleId: string): Promise<ClassScheduleDocument | null> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, scheduleId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as ClassScheduleDocument;
      } else {
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching schedule:', error);
      throw new Error(`Failed to fetch schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a schedule
   */
  static async updateSchedule(scheduleId: string, updateData: Partial<ClassScheduleData>): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, scheduleId);
      
      const cleanUpdateData: any = {
        updatedAt: Timestamp.now(),
      };

      // Only add fields that have defined values
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'scheduledDate' && value instanceof Date) {
            cleanUpdateData[key] = Timestamp.fromDate(value);
          } else {
            cleanUpdateData[key] = value;
          }
        }
      });

      await updateDoc(docRef, cleanUpdateData);
      console.log('✅ Schedule updated successfully');
    } catch (error) {
      console.error('❌ Error updating schedule:', error);
      throw new Error(`Failed to update schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a schedule
   */
  static async deleteSchedule(scheduleId: string): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, scheduleId);
      await deleteDoc(docRef);
      console.log('✅ Schedule deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting schedule:', error);
      throw new Error(`Failed to delete schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update schedule status
   */
  static async updateScheduleStatus(
    scheduleId: string, 
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
  ): Promise<void> {
    try {
      await this.updateSchedule(scheduleId, { 
        status,
        updatedBy: 'system' // TODO: Use actual user ID
      });
      console.log('✅ Schedule status updated successfully');
    } catch (error) {
      console.error('❌ Error updating schedule status:', error);
      throw new Error(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark attendance for a schedule
   */
  static async markAttendance(
    scheduleId: string, 
    studentAttendance: StudentAttendanceData[]
  ): Promise<void> {
    try {
      const presentCount = studentAttendance.filter(s => s.status === 'present').length;
      const absentCount = studentAttendance.filter(s => s.status === 'absent').length;
      const lateCount = studentAttendance.filter(s => s.status === 'late').length;
      const totalStudents = studentAttendance.length;
      const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0;

      const attendanceData = {
        attendance: {
          totalStudents,
          presentCount,
          absentCount,
          lateCount,
          attendanceRate,
          students: studentAttendance.map(student => ({
            studentId: student.studentId,
            studentName: student.studentName,
            studentEmail: student.studentEmail,
            status: student.status,
            markedAt: new Date(),
            ...(student.markedBy && { markedBy: student.markedBy }),
            ...(student.notes && { notes: student.notes })
          })),
          lastUpdatedAt: new Date(),
          lastUpdatedBy: 'teacher' // TODO: Use actual teacher ID
        }
      };

      await this.updateSchedule(scheduleId, attendanceData);
      console.log('✅ Attendance marked successfully');
    } catch (error) {
      console.error('❌ Error marking attendance:', error);
      throw new Error(`Failed to mark attendance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get upcoming schedules for a class
   */
  static async getUpcomingSchedules(classId: string, limitCount: number = 5): Promise<ClassScheduleDocument[]> {
    try {
      const now = new Date();
      const q = query(
        this.collectionRef,
        where('classId', '==', classId),
        where('scheduledDate', '>=', Timestamp.fromDate(now)),
        orderBy('scheduledDate', 'asc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClassScheduleDocument));
    } catch (error) {
      console.error('❌ Error getting upcoming schedules:', error);
      // Fallback to client-side filtering
      const allSchedules = await this.getSchedulesByClassId(classId);
      const now = new Date();
      
      return allSchedules
        .filter(schedule => {
          const scheduleDate = schedule.scheduledDate instanceof Timestamp 
            ? schedule.scheduledDate.toDate() 
            : schedule.scheduledDate;
          return scheduleDate >= now;
        })
        .sort((a, b) => {
          const dateA = a.scheduledDate instanceof Timestamp ? a.scheduledDate.toDate() : a.scheduledDate;
          const dateB = b.scheduledDate instanceof Timestamp ? b.scheduledDate.toDate() : b.scheduledDate;
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, limitCount);
    }
  }

  /**
   * Cancel a scheduled class
   */
  static async cancelSchedule(
    scheduleId: string, 
    cancellationReason: string, 
    cancelledBy: string = 'teacher'
  ): Promise<void> {
    try {
      const scheduleDoc = doc(firestore, COLLECTION_NAME, scheduleId);
      
      await updateDoc(scheduleDoc, {
        status: 'cancelled',
        cancellationReason: cancellationReason,
        cancelledAt: Timestamp.now(),
        cancelledBy: cancelledBy,
        updatedAt: Timestamp.now(),
        updatedBy: cancelledBy
      });
      
      console.log('✅ Schedule cancelled successfully:', scheduleId);
    } catch (error) {
      console.error('❌ Error cancelling schedule:', error);
      throw new Error(`Failed to cancel schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to real-time updates for class schedules
   */
  static subscribeToSchedules(
    classId: string,
    onSuccess: (schedules: ClassScheduleDocument[]) => void,
    onError: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        this.collectionRef,
        where('classId', '==', classId),
        orderBy('scheduledDate', 'asc')
      );
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const schedules = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as ClassScheduleDocument));
          
          onSuccess(schedules);
        },
        (error) => {
          console.error('❌ Real-time subscription error:', error);
          onError(new Error(`Real-time subscription failed: ${error.message}`));
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('❌ Error setting up real-time subscription:', error);
      onError(new Error(`Failed to setup subscription: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return () => {};
    }
  }
}

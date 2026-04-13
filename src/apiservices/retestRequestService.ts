// Retest Request Service
// Handles student retest requests and teacher approval flow

import { firestore } from '@/utils/firebase-client';
import {
  doc,
  updateDoc,
  Timestamp,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  addDoc
} from 'firebase/firestore';
import { Test, FlexibleTest, LiveTest, InClassTest } from '@/models/testSchema';
import { RetestRequest, RetestRequestSummary } from '@/models/retestRequestSchema';
import { v4 as uuidv4 } from 'uuid';

export class RetestRequestService {
  private static COLLECTIONS = {
    RETEST_REQUESTS: 'retest_requests',
    TESTS: 'tests',
    STUDENT_SUBMISSIONS: 'studentSubmissions',
    STUDENT_ENROLLMENTS: 'student_enrollments'
  };

  /**
   * Safely convert timestamp to Date object
   */
  private static convertTimestampToDate(timestamp: any): Date {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    } else if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      return timestamp;
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp);
    } else {
      console.error('Unknown timestamp format:', timestamp);
      return new Date();
    }
  }

  /**
   * Remove undefined fields from an object before writing to Firestore
   */
  private static removeUndefined(obj: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined)
    );
  }

  /**
   * Check if a test's completion date is more than 7 days ago
   */
  static isTestOlderThanOneWeek(test: Test): boolean {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let completionDate: Date;

    if (test.type === 'flexible') {
      const flexTest = test as FlexibleTest;
      completionDate = this.convertTimestampToDate(flexTest.availableTo);
    } else if (test.type === 'live') {
      const liveTest = test as LiveTest;
      completionDate = this.convertTimestampToDate(liveTest.actualEndTime);
    } else if (test.type === 'in-class') {
      const inClassTest = test as InClassTest;
      const startDate = this.convertTimestampToDate(inClassTest.scheduledStartTime);
      completionDate = new Date(startDate.getTime() + (inClassTest.duration || 60) * 60 * 1000);
    } else {
      return false;
    }

    return completionDate < oneWeekAgo;
  }

  /**
   * Create a retest request from a student
   */
  static async createRetestRequest(params: {
    testId: string;
    testTitle: string;
    testNumber?: number;
    displayNumber?: string;
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    studentId: string;
    studentName: string;
    reason: string;
    teacherId: string;
    teacherName: string;
  }): Promise<RetestRequest> {
    try {
      console.log('🔄 Creating retest request:', {
        testId: params.testId,
        studentId: params.studentId
      });

      // Validate reason length
      if (!params.reason || params.reason.trim().length < 10) {
        throw new Error('Please provide a reason with at least 10 characters');
      }

      // Check the test exists and is completed
      const testDoc = await getDoc(doc(firestore, this.COLLECTIONS.TESTS, params.testId));
      if (!testDoc.exists()) {
        throw new Error('Test not found');
      }

      const test = { id: testDoc.id, ...testDoc.data() } as Test;

      // Check test is not deleted or cancelled
      if (test.isDeleted || test.status === 'cancelled') {
        throw new Error('Cannot request retest for a deleted or cancelled test');
      }

      // Check test is older than 1 week
      if (!this.isTestOlderThanOneWeek(test)) {
        throw new Error('Retest requests are only available for tests completed more than 1 week ago');
      }

      // Check for duplicate pending request
      const existingRequest = await this.getStudentRetestRequestForTest(
        params.studentId,
        params.testId
      );
      if (existingRequest && existingRequest.status === 'pending') {
        throw new Error('You already have a pending retest request for this test');
      }

      // Check if a retake already exists for this student + test
      const existingRetest = await this.getExistingRetestForStudent(params.testId, params.studentId);
      if (existingRetest) {
        throw new Error('A retake has already been created for you for this test. Check your Retakes tab.');
      }

      // Create the request
      const requestId = uuidv4();
      const request: RetestRequest = {
        id: requestId,
        testId: params.testId,
        testTitle: params.testTitle,
        testNumber: params.testNumber,
        displayNumber: params.displayNumber,
        classId: params.classId,
        className: params.className,
        subjectId: params.subjectId,
        subjectName: params.subjectName,
        studentId: params.studentId,
        studentName: params.studentName,
        reason: params.reason.trim(),
        teacherId: params.teacherId,
        teacherName: params.teacherName,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(
        doc(firestore, this.COLLECTIONS.RETEST_REQUESTS, requestId),
        this.removeUndefined(request as Record<string, any>)
      );

      console.log('✅ Retest request created successfully');
      return request;
    } catch (error) {
      console.error('❌ Error creating retest request:', error);
      throw error;
    }
  }

  /**
   * Get a student's retest request for a specific test
   */
  static async getStudentRetestRequestForTest(
    studentId: string,
    testId: string
  ): Promise<RetestRequest | null> {
    try {
      const requestsRef = collection(firestore, this.COLLECTIONS.RETEST_REQUESTS);
      const q = query(
        requestsRef,
        where('studentId', '==', studentId),
        where('testId', '==', testId)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      // Return the most recent request
      let mostRecent: RetestRequest | null = null;
      snapshot.forEach((doc) => {
        const request = { id: doc.id, ...doc.data() } as RetestRequest;
        if (!mostRecent || request.createdAt.seconds > mostRecent.createdAt.seconds) {
          mostRecent = request;
        }
      });

      return mostRecent;
    } catch (error) {
      console.error('Error checking student retest request:', error);
      return null;
    }
  }

  /**
   * Get all retest requests for a student (for status display)
   */
  static async getStudentRetestRequests(
    studentId: string
  ): Promise<RetestRequest[]> {
    try {
      const requestsRef = collection(firestore, this.COLLECTIONS.RETEST_REQUESTS);
      const q = query(
        requestsRef,
        where('studentId', '==', studentId)
      );

      const snapshot = await getDocs(q);
      const requests: RetestRequest[] = [];

      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as RetestRequest);
      });

      console.log(`✅ Retrieved ${requests.length} retest requests for student ${studentId}`);
      return requests;
    } catch (error) {
      console.error('Error getting student retest requests:', error);
      return [];
    }
  }

  /**
   * Check if a retake test already exists for a specific student + original test.
   * Since each approval creates one test per student, we check allowedStudentIds.
   */
  static async getExistingRetestForStudent(
    originalTestId: string,
    studentId: string
  ): Promise<Test | null> {
    try {
      const testsRef = collection(firestore, this.COLLECTIONS.TESTS);
      const q = query(
        testsRef,
        where('originalTestId', '==', originalTestId),
        where('isRetest', '==', true),
        where('allowedStudentIds', 'array-contains', studentId)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as Test;
    } catch (error) {
      console.error('Error checking existing retest for student:', error);
      return null;
    }
  }

  /**
   * Get all retest requests for a teacher, grouped by test
   */
  static async getTeacherRetestRequests(
    teacherId: string
  ): Promise<RetestRequestSummary[]> {
    try {
      const requestsRef = collection(firestore, this.COLLECTIONS.RETEST_REQUESTS);
      const q = query(
        requestsRef,
        where('teacherId', '==', teacherId)
      );

      const snapshot = await getDocs(q);
      const allRequests: RetestRequest[] = [];

      snapshot.forEach((doc) => {
        allRequests.push({ id: doc.id, ...doc.data() } as RetestRequest);
      });

      // Group by testId + classId
      const groupMap = new Map<string, RetestRequest[]>();
      allRequests.forEach((request) => {
        const key = `${request.testId}_${request.classId}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(request);
      });

      // Build summaries
      const summaries: RetestRequestSummary[] = [];
      groupMap.forEach((requests) => {
        const first = requests[0];
        summaries.push({
          testId: first.testId,
          testTitle: first.testTitle,
          testNumber: first.testNumber,
          displayNumber: first.displayNumber,
          classId: first.classId,
          className: first.className,
          subjectId: first.subjectId,
          subjectName: first.subjectName,
          teacherId: first.teacherId,
          totalRequests: requests.length,
          pendingRequests: requests.filter((r) => r.status === 'pending').length,
          approvedRequests: requests.filter((r) => r.status === 'approved').length,
          deniedRequests: requests.filter((r) => r.status === 'denied').length,
          requests: requests.sort(
            (a, b) => b.createdAt.seconds - a.createdAt.seconds
          )
        });
      });

      // Sort by number of pending requests (most first)
      summaries.sort((a, b) => b.pendingRequests - a.pendingRequests);

      console.log(`✅ Retrieved ${summaries.length} retest request groups for teacher ${teacherId}`);
      return summaries;
    } catch (error) {
      console.error('Error getting teacher retest requests:', error);
      return [];
    }
  }

  /**
   * Get count of pending retest requests for a teacher (for sidebar badge)
   */
  static async getPendingRetestCount(teacherId: string): Promise<number> {
    try {
      const requestsRef = collection(firestore, this.COLLECTIONS.RETEST_REQUESTS);
      const q = query(
        requestsRef,
        where('teacherId', '==', teacherId),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting pending retest count:', error);
      return 0;
    }
  }

  /**
   * Approve a single student's retest request — creates one retake test for that student only.
   * The teacher sets the schedule per student, so two students can have different windows.
   */
  static async approveRetestForStudent(params: {
    requestId: string;
    teacherId: string;
    teacherName: string;
    reviewNote?: string;
    schedulingData: {
      type: 'live' | 'flexible';
      scheduledStartTime?: Date;
      duration?: number;
      bufferTime?: number;
      availableFrom?: Date;
      availableTo?: Date;
      isUntimed?: boolean;
    };
  }): Promise<{ retestId: string; retestTitle: string }> {
    try {
      // 1. Load the request
      const requestDoc = await getDoc(doc(firestore, this.COLLECTIONS.RETEST_REQUESTS, params.requestId));
      if (!requestDoc.exists()) throw new Error('Retest request not found');
      const request = { id: requestDoc.id, ...requestDoc.data() } as RetestRequest;

      if (request.status !== 'pending') throw new Error('This request has already been reviewed');

      // 2. Load the original test
      const testDoc = await getDoc(doc(firestore, this.COLLECTIONS.TESTS, request.testId));
      if (!testDoc.exists()) throw new Error('Original test not found');
      const originalTest = { id: testDoc.id, ...testDoc.data() } as Test;

      // 3. Guard: no duplicate retake for this student + original test
      const existingRetest = await this.getExistingRetestForStudent(request.testId, request.studentId);
      if (existingRetest) throw new Error('A retake already exists for this student for this test');

      // 4. Resolve class name
      const classIdx = originalTest.classIds?.indexOf(request.classId) ?? -1;
      const className = classIdx >= 0 ? (originalTest.classNames?.[classIdx] || '') : '';

      // 5. Clone original test, strip identity fields
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        status: _status,
        isDeleted: _isDeleted,
        deletedAt: _deletedAt,
        deletedBy: _deletedBy,
        testNumber: _testNumber,
        displayNumber: _displayNumber,
        numberAssignmentId: _numberAssignmentId,
        ...baseTestData
      } = originalTest as any;

      const now = Timestamp.now();
      const scheduling = params.schedulingData;
      const retestTitle = `${originalTest.title} (Retake)`;

      const newTestData: any = {
        ...baseTestData,
        title: retestTitle,
        testNumber: null,
        displayNumber: null,
        numberAssignmentId: null,

        isRetest: true,
        originalTestId: originalTest.id,
        originalTestTitle: originalTest.title,
        originalTestNumber: originalTest.testNumber ?? null,
        originalDisplayNumber: originalTest.displayNumber ?? null,
        retestApprovedBy: params.teacherName,

        // Only this student may access the retake
        allowedStudentIds: [request.studentId],

        classIds: [request.classId],
        classNames: [className],
        assignmentType: 'class-based',

        status: 'scheduled',
        createdAt: now,
        updatedAt: now
      };

      // 6. Apply scheduling
      if (scheduling.type === 'live') {
        newTestData.type = 'live';
        newTestData.scheduledStartTime = Timestamp.fromDate(scheduling.scheduledStartTime!);
        newTestData.duration = scheduling.duration ?? (originalTest.type === 'live' ? (originalTest as LiveTest).duration : 60);
        newTestData.bufferTime = scheduling.bufferTime ?? 5;
        newTestData.studentJoinTime = Timestamp.fromDate(scheduling.scheduledStartTime!);
        const endTime = new Date(scheduling.scheduledStartTime!.getTime() +
          (newTestData.duration + newTestData.bufferTime) * 60 * 1000);
        newTestData.actualEndTime = Timestamp.fromDate(endTime);
        newTestData.isLive = false;
        newTestData.studentsOnline = 0;
        newTestData.studentsCompleted = 0;
      } else {
        newTestData.type = 'flexible';
        newTestData.availableFrom = Timestamp.fromDate(scheduling.availableFrom!);
        newTestData.availableTo = Timestamp.fromDate(scheduling.availableTo!);
        newTestData.duration = scheduling.duration ?? (originalTest.type === 'flexible' ? (originalTest as FlexibleTest).duration : 60);
        newTestData.attemptsAllowed = 1;
        newTestData.isUntimed = scheduling.isUntimed ?? false;
      }

      // 7. Write the new retake test
      const newTestRef = await addDoc(
        collection(firestore, this.COLLECTIONS.TESTS),
        this.removeUndefined(newTestData)
      );
      const retestId = newTestRef.id;

      // 8. Mark the request approved
      await updateDoc(doc(firestore, this.COLLECTIONS.RETEST_REQUESTS, params.requestId), {
        status: 'approved',
        reviewedAt: now,
        reviewedBy: params.teacherId,
        reviewNote: params.reviewNote || '',
        retestTestId: retestId,
        updatedAt: now
      });

      console.log('✅ Retake approved for student:', request.studentName, retestId);
      return { retestId, retestTitle };
    } catch (error) {
      console.error('❌ Error approving retake for student:', error);
      throw error;
    }
  }

  /**
   * Deny a single retest request
   */
  static async denyRetestRequest(
    requestId: string,
    teacherId: string,
    reviewNote?: string
  ): Promise<void> {
    try {
      await updateDoc(
        doc(firestore, this.COLLECTIONS.RETEST_REQUESTS, requestId),
        {
          status: 'denied',
          reviewedAt: Timestamp.now(),
          reviewedBy: teacherId,
          reviewNote: reviewNote || '',
          updatedAt: Timestamp.now()
        }
      );
      console.log('✅ Retest request denied');
    } catch (error) {
      console.error('❌ Error denying retest request:', error);
      throw error;
    }
  }

  /**
   * Deny all pending retest requests for a test+class
   */
  static async denyAllRetestRequests(
    testId: string,
    classId: string,
    teacherId: string,
    reviewNote?: string
  ): Promise<void> {
    try {
      const requestsRef = collection(firestore, this.COLLECTIONS.RETEST_REQUESTS);
      const q = query(
        requestsRef,
        where('testId', '==', testId),
        where('classId', '==', classId),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      const now = Timestamp.now();

      const updatePromises = snapshot.docs.map((requestDoc) =>
        updateDoc(doc(firestore, this.COLLECTIONS.RETEST_REQUESTS, requestDoc.id), {
          status: 'denied',
          reviewedAt: now,
          reviewedBy: teacherId,
          reviewNote: reviewNote || '',
          updatedAt: now
        })
      );

      await Promise.all(updatePromises);
      console.log(`✅ Denied ${snapshot.size} retest requests`);
    } catch (error) {
      console.error('❌ Error denying all retest requests:', error);
      throw error;
    }
  }

  /**
   * Get retake tests for a student.
   * Only returns tests where the student was explicitly allowed (i.e. they requested the retest).
   * Uses the allowedStudentIds field so non-requesting classmates never see these tests.
   */
  static async getStudentRetakes(studentId: string): Promise<Test[]> {
    try {
      const testsRef = collection(firestore, this.COLLECTIONS.TESTS);
      const q = query(
        testsRef,
        where('isRetest', '==', true),
        where('allowedStudentIds', 'array-contains', studentId)
      );

      const snapshot = await getDocs(q);
      const retakeTests: Test[] = [];
      snapshot.forEach((doc) => {
        const test = { id: doc.id, ...doc.data() } as Test;
        if (test.isDeleted === true) return;
        retakeTests.push(test);
      });

      // Sort by creation date (newest first)
      retakeTests.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      console.log(`✅ Retrieved ${retakeTests.length} retake tests for student ${studentId}`);
      return retakeTests;
    } catch (error) {
      console.error('Error getting student retakes:', error);
      return [];
    }
  }

  /**
   * Get retake tests created by a teacher (tests where isRetest is true).
   * Used by the teacher Retakes page so retakes don't pollute the main tests list.
   */
  static async getTeacherRetakes(teacherId: string): Promise<Test[]> {
    try {
      const testsRef = collection(firestore, this.COLLECTIONS.TESTS);
      const q = query(
        testsRef,
        where('teacherId', '==', teacherId),
        where('isRetest', '==', true)
      );

      const snapshot = await getDocs(q);
      const retakes: Test[] = [];
      snapshot.forEach((doc) => {
        const test = { id: doc.id, ...doc.data() } as Test;
        if (test.isDeleted === true) return;
        retakes.push(test);
      });

      retakes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return retakes;
    } catch (error) {
      console.error('Error getting teacher retakes:', error);
      return [];
    }
  }

  /**
   * Get submission data for comparison (original + retest)
   */
  static async getRetakeComparison(
    studentId: string,
    retestTestId: string,
    originalTestId: string
  ): Promise<{
    originalSubmission: any | null;
    retakeSubmission: any | null;
    improvement: number | null;
  }> {
    try {
      const submissionsRef = collection(firestore, this.COLLECTIONS.STUDENT_SUBMISSIONS);

      // Get original submission
      const originalQuery = query(
        submissionsRef,
        where('testId', '==', originalTestId),
        where('studentId', '==', studentId)
      );
      const originalSnapshot = await getDocs(originalQuery);
      const originalSubmission = originalSnapshot.empty
        ? null
        : { id: originalSnapshot.docs[0].id, ...originalSnapshot.docs[0].data() };

      // Get retake submission
      const retakeQuery = query(
        submissionsRef,
        where('testId', '==', retestTestId),
        where('studentId', '==', studentId)
      );
      const retakeSnapshot = await getDocs(retakeQuery);
      const retakeSubmission = retakeSnapshot.empty
        ? null
        : { id: retakeSnapshot.docs[0].id, ...retakeSnapshot.docs[0].data() };

      // Calculate improvement
      let improvement: number | null = null;
      if (originalSubmission && retakeSubmission) {
        const originalPct = (originalSubmission as any).percentage || 0;
        const retakePct = (retakeSubmission as any).percentage || 0;
        improvement = retakePct - originalPct;
      }

      return { originalSubmission, retakeSubmission, improvement };
    } catch (error) {
      console.error('Error getting retake comparison:', error);
      return { originalSubmission: null, retakeSubmission: null, improvement: null };
    }
  }
}

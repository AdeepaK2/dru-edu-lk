import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp,
  limit as firestoreLimit 
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

// Types for sync data
interface SyncStudent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'Active' | 'Inactive';
  enrollments: SyncEnrollment[];
  parent?: {
    name: string;
    email: string;
    phone: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface SyncEnrollment {
  id: string;
  classId: string;
  className: string;
  subject: string;
  status: 'Active' | 'Inactive' | 'Completed' | 'Dropped';
  enrolledAt: string;
  grade?: number;
  attendance: number;
  createdAt: string;
  updatedAt: string;
}

interface SyncClass {
  id: string;
  classId: string;
  name: string;
  subject: string;
  subjectId: string;
  year: string;
  centerId: '1' | '2';
  schedule: Array<{
    day: string;
    startTime: string;
    endTime: string;
  }>;
  sessionFee: number;
  teacherId?: string;
  teacherName?: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  enrolledStudents: number;
  waitingList: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface SyncResponse {
  success: boolean;
  data: {
    students: SyncStudent[];
    classes: SyncClass[];
    metadata: {
      totalStudents: number;
      totalClasses: number;
      totalActiveEnrollments: number;
      lastSyncTimestamp: string;
      requestedSince?: string;
    };
  };
  error?: string;
}

// Helper function to convert Firestore Timestamp to ISO string
function timestampToISOString(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return new Date(timestamp).toISOString();
}

// Validate API Key
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const validApiKey = process.env.X_KEY;
  
  if (!apiKey || !validApiKey) {
    return false;
  }
  
  return apiKey === validApiKey;
}

// Get students with their enrollments
async function getStudentsData(sinceDate?: Date, limit?: number): Promise<SyncStudent[]> {
  try {
    let studentsQuery = query(
      collection(firestore, 'students'),
      orderBy('updatedAt', 'desc')
    );

    // Add date filter if provided
    if (sinceDate) {
      studentsQuery = query(
        collection(firestore, 'students'),
        where('updatedAt', '>=', Timestamp.fromDate(sinceDate)),
        orderBy('updatedAt', 'desc')
      );
    }

    // Add limit if provided
    if (limit) {
      studentsQuery = query(
        studentsQuery,
        firestoreLimit(limit)
      );
    }

    const studentsSnapshot = await getDocs(studentsQuery);
    const students: SyncStudent[] = [];

    for (const studentDoc of studentsSnapshot.docs) {
      const studentData = studentDoc.data();
      
      // Get enrollments for this student
      const enrollmentsQuery = query(
        collection(firestore, 'studentEnrollments'),
        where('studentId', '==', studentDoc.id),
        orderBy('createdAt', 'desc')
      );

      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      const enrollments: SyncEnrollment[] = enrollmentsSnapshot.docs.map(enrollDoc => {
        const enrollData = enrollDoc.data();
        return {
          id: enrollDoc.id,
          classId: enrollData.classId,
          className: enrollData.className,
          subject: enrollData.subject,
          status: enrollData.status,
          enrolledAt: timestampToISOString(enrollData.enrolledAt),
          grade: enrollData.grade,
          attendance: enrollData.attendance || 0,
          createdAt: timestampToISOString(enrollData.createdAt),
          updatedAt: timestampToISOString(enrollData.updatedAt),
        };
      });

      students.push({
        id: studentDoc.id,
        name: studentData.name,
        email: studentData.email,
        phone: studentData.phone,
        status: studentData.status,
        enrollments,
        parent: studentData.parent ? {
          name: studentData.parent.name,
          email: studentData.parent.email,
          phone: studentData.parent.phone,
        } : undefined,
        createdAt: timestampToISOString(studentData.createdAt),
        updatedAt: timestampToISOString(studentData.updatedAt),
      });
    }

    return students;
  } catch (error) {
    console.error('Error fetching students data:', error);
    throw new Error(`Failed to fetch students: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get classes data
async function getClassesData(sinceDate?: Date, limit?: number): Promise<SyncClass[]> {
  try {
    let classesQuery = query(
      collection(firestore, 'classes'),
      orderBy('updatedAt', 'desc')
    );

    // Add date filter if provided
    if (sinceDate) {
      classesQuery = query(
        collection(firestore, 'classes'),
        where('updatedAt', '>=', Timestamp.fromDate(sinceDate)),
        orderBy('updatedAt', 'desc')
      );
    }

    // Add limit if provided
    if (limit) {
      classesQuery = query(
        classesQuery,
        firestoreLimit(limit)
      );
    }

    const classesSnapshot = await getDocs(classesQuery);
    const classes: SyncClass[] = [];

    for (const classDoc of classesSnapshot.docs) {
      const classData = classDoc.data();
      
      // Get teacher name if teacherId exists
      let teacherName = undefined;
      if (classData.teacherId) {
        try {
          const teacherQuery = query(
            collection(firestore, 'teachers'),
            where('__name__', '==', classData.teacherId)
          );
          const teacherSnapshot = await getDocs(teacherQuery);
          if (!teacherSnapshot.empty) {
            teacherName = teacherSnapshot.docs[0].data().name;
          }
        } catch (error) {
          console.warn(`Could not fetch teacher name for ${classData.teacherId}`);
        }
      }

      classes.push({
        id: classDoc.id,
        classId: classData.classId,
        name: classData.name,
        subject: classData.subject,
        subjectId: classData.subjectId,
        year: classData.year,
        centerId: classData.centerId,
        schedule: classData.schedule || [],
        sessionFee: classData.sessionFee || 0,
        teacherId: classData.teacherId,
        teacherName,
        status: classData.status,
        enrolledStudents: classData.enrolledStudents || 0,
        waitingList: classData.waitingList || 0,
        description: classData.description,
        createdAt: timestampToISOString(classData.createdAt),
        updatedAt: timestampToISOString(classData.updatedAt),
      });
    }

    return classes;
  } catch (error) {
    console.error('Error fetching classes data:', error);
    throw new Error(`Failed to fetch classes: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// GET endpoint for syncing data
export async function GET(request: NextRequest) {
  try {
    // Validate API Key
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or missing X-API-Key header' 
        },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get('since'); // ISO date string for incremental sync
    const limit = searchParams.get('limit'); // Limit number of records
    const includeStudents = searchParams.get('includeStudents') !== 'false'; // Default true
    const includeClasses = searchParams.get('includeClasses') !== 'false'; // Default true

    // Parse since date if provided
    let sinceDate: Date | undefined;
    if (since) {
      sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid since date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)' 
          },
          { status: 400 }
        );
      }
    }

    // Parse limit if provided
    let limitNumber: number | undefined;
    if (limit) {
      limitNumber = parseInt(limit);
      if (isNaN(limitNumber) || limitNumber <= 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid limit parameter. Must be a positive integer' 
          },
          { status: 400 }
        );
      }
    }

    // Fetch data
    const studentsData = includeStudents ? await getStudentsData(sinceDate, limitNumber) : [];
    const classesData = includeClasses ? await getClassesData(sinceDate, limitNumber) : [];

    // Calculate total active enrollments
    const totalActiveEnrollments = studentsData.reduce((total, student) => {
      return total + student.enrollments.filter(enrollment => enrollment.status === 'Active').length;
    }, 0);

    const response: SyncResponse = {
      success: true,
      data: {
        students: studentsData,
        classes: classesData,
        metadata: {
          totalStudents: studentsData.length,
          totalClasses: classesData.length,
          totalActiveEnrollments,
          lastSyncTimestamp: new Date().toISOString(),
          requestedSince: since || undefined,
        },
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in sync API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

// POST endpoint for checking specific records by IDs
export async function POST(request: NextRequest) {
  try {
    // Validate API Key
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or missing X-API-Key header' 
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { studentIds, classIds } = body;

    if (!studentIds && !classIds) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Either studentIds or classIds array must be provided' 
        },
        { status: 400 }
      );
    }

    const result: { students: SyncStudent[]; classes: SyncClass[] } = {
      students: [],
      classes: []
    };

    // Fetch specific students if requested
    if (studentIds && Array.isArray(studentIds)) {
      for (const studentId of studentIds) {
        try {
          const studentQuery = query(
            collection(firestore, 'students'),
            where('__name__', '==', studentId)
          );
          const studentSnapshot = await getDocs(studentQuery);
          
          if (!studentSnapshot.empty) {
            const studentDoc = studentSnapshot.docs[0];
            const studentData = studentDoc.data();
            
            // Get enrollments for this student
            const enrollmentsQuery = query(
              collection(firestore, 'studentEnrollments'),
              where('studentId', '==', studentId)
            );
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            const enrollments: SyncEnrollment[] = enrollmentsSnapshot.docs.map(enrollDoc => {
              const enrollData = enrollDoc.data();
              return {
                id: enrollDoc.id,
                classId: enrollData.classId,
                className: enrollData.className,
                subject: enrollData.subject,
                status: enrollData.status,
                enrolledAt: timestampToISOString(enrollData.enrolledAt),
                grade: enrollData.grade,
                attendance: enrollData.attendance || 0,
                createdAt: timestampToISOString(enrollData.createdAt),
                updatedAt: timestampToISOString(enrollData.updatedAt),
              };
            });

            result.students.push({
              id: studentDoc.id,
              name: studentData.name,
              email: studentData.email,
              phone: studentData.phone,
              status: studentData.status,
              enrollments,
              parent: studentData.parent ? {
                name: studentData.parent.name,
                email: studentData.parent.email,
                phone: studentData.parent.phone,
              } : undefined,
              createdAt: timestampToISOString(studentData.createdAt),
              updatedAt: timestampToISOString(studentData.updatedAt),
            });
          }
        } catch (error) {
          console.warn(`Error fetching student ${studentId}:`, error);
        }
      }
    }

    // Fetch specific classes if requested
    if (classIds && Array.isArray(classIds)) {
      for (const classId of classIds) {
        try {
          const classQuery = query(
            collection(firestore, 'classes'),
            where('__name__', '==', classId)
          );
          const classSnapshot = await getDocs(classQuery);
          
          if (!classSnapshot.empty) {
            const classDoc = classSnapshot.docs[0];
            const classData = classDoc.data();
            
            // Get teacher name if teacherId exists
            let teacherName = undefined;
            if (classData.teacherId) {
              try {
                const teacherQuery = query(
                  collection(firestore, 'teachers'),
                  where('__name__', '==', classData.teacherId)
                );
                const teacherSnapshot = await getDocs(teacherQuery);
                if (!teacherSnapshot.empty) {
                  teacherName = teacherSnapshot.docs[0].data().name;
                }
              } catch (error) {
                console.warn(`Could not fetch teacher name for ${classData.teacherId}`);
              }
            }

            result.classes.push({
              id: classDoc.id,
              classId: classData.classId,
              name: classData.name,
              subject: classData.subject,
              subjectId: classData.subjectId,
              year: classData.year,
              centerId: classData.centerId,
              schedule: classData.schedule || [],
              sessionFee: classData.sessionFee || 0,
              teacherId: classData.teacherId,
              teacherName,
              status: classData.status,
              enrolledStudents: classData.enrolledStudents || 0,
              waitingList: classData.waitingList || 0,
              description: classData.description,
              createdAt: timestampToISOString(classData.createdAt),
              updatedAt: timestampToISOString(classData.updatedAt),
            });
          }
        } catch (error) {
          console.warn(`Error fetching class ${classId}:`, error);
        }
      }
    }

    const response: SyncResponse = {
      success: true,
      data: {
        students: result.students,
        classes: result.classes,
        metadata: {
          totalStudents: result.students.length,
          totalClasses: result.classes.length,
          totalActiveEnrollments: result.students.reduce((total, student) => {
            return total + student.enrollments.filter(enrollment => enrollment.status === 'Active').length;
          }, 0),
          lastSyncTimestamp: new Date().toISOString(),
        },
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in POST sync API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}
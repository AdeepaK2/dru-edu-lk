import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp,
  limit as firestoreLimit,
  startAfter,
  doc,
  getDoc
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

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
      hasMoreData: boolean;
      nextPageToken?: string;
      lastSyncTimestamp: string;
      requestedSince?: string;
      serverTimestamp: string;
      dataIntegrity: {
        studentsHash: string;
        classesHash: string;
      };
    };
  };
  performance: {
    responseTimeMs: number;
    recordsPerSecond: number;
    cacheHitRate?: number;
  };
  error?: string;
  warnings?: string[];
}

// Rate limiting interfaces
interface RateLimitInfo {
  count: number;
  resetTime: number;
}

interface SyncOptions {
  sinceDate?: Date;
  limit?: number;
  cursor?: string;
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

// Rate limiting store (in production, use Redis or a proper cache)
const rateLimitStore = new Map<string, RateLimitInfo>();

// Check rate limit
function checkRateLimit(apiKey: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const clientInfo = rateLimitStore.get(apiKey);
  
  if (!clientInfo || now > clientInfo.resetTime) {
    rateLimitStore.set(apiKey, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (clientInfo.count >= maxRequests) {
    return false;
  }
  
  clientInfo.count++;
  return true;
}

// Get students with their enrollments (optimized with parallel processing)
async function getStudentsData(sinceDate?: Date, limit?: number): Promise<SyncStudent[]> {
  try {
    const startTime = Date.now();
    
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
    
    // Parallel enrollment fetching for all students
    const enrollmentPromises = studentsSnapshot.docs.map(async (studentDoc) => {
      const enrollmentsQuery = query(
        collection(firestore, 'studentEnrollments'),
        where('studentId', '==', studentDoc.id),
        orderBy('createdAt', 'desc')
      );
      
      return getDocs(enrollmentsQuery);
    });

    const enrollmentsResults = await Promise.all(enrollmentPromises);
    
    // Process results
    const students: SyncStudent[] = studentsSnapshot.docs.map((studentDoc, index) => {
      const studentData = studentDoc.data();
      const enrollmentsSnapshot = enrollmentsResults[index];
      
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

      return {
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
      };
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ Processed ${students.length} students with ${students.reduce((total, s) => total + s.enrollments.length, 0)} enrollments in ${processingTime}ms`);
    
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

// GET endpoint for syncing data (enhanced with performance optimizations)
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const warnings: string[] = [];
  
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

    const apiKey = request.headers.get('X-API-Key')!;
    
    // Check rate limit
    if (!checkRateLimit(apiKey)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded. Maximum 60 requests per minute.' 
        },
        { status: 429 }
      );
    }

    // Get query parameters with enhanced validation
    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get('since'); // ISO date string for incremental sync
    const limit = searchParams.get('limit'); // Limit number of records
    const includeStudents = searchParams.get('includeStudents') !== 'false'; // Default true
    const includeClasses = searchParams.get('includeClasses') !== 'false'; // Default true
    const compress = searchParams.get('compress') === 'true'; // Compression flag

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

    // Parse and validate limit
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
      
      if (limitNumber > 1000) {
        limitNumber = 1000;
        warnings.push('Limit capped at 1000 records for performance reasons');
      }
    }

    // Fetch data in parallel for better performance
    const [studentsData, classesData] = await Promise.all([
      includeStudents ? getStudentsData(sinceDate, limitNumber) : Promise.resolve([]),
      includeClasses ? getClassesData(sinceDate, limitNumber) : Promise.resolve([])
    ]);

    // Calculate metadata
    const totalActiveEnrollments = studentsData.reduce((total, student) => {
      return total + student.enrollments.filter(enrollment => enrollment.status === 'Active').length;
    }, 0);

    const hasMoreData = limitNumber ? 
      (studentsData.length === limitNumber || classesData.length === limitNumber) : 
      false;

    const nextPageToken = hasMoreData && studentsData.length > 0 ? 
      studentsData[studentsData.length - 1].id : 
      undefined;

    const processingTime = Date.now() - startTime;
    const totalRecords = studentsData.length + classesData.length;

    const response: SyncResponse = {
      success: true,
      data: {
        students: studentsData,
        classes: classesData,
        metadata: {
          totalStudents: studentsData.length,
          totalClasses: classesData.length,
          totalActiveEnrollments,
          hasMoreData,
          nextPageToken,
          lastSyncTimestamp: new Date().toISOString(),
          requestedSince: since || undefined,
          serverTimestamp: new Date().toISOString(),
          dataIntegrity: {
            studentsHash: `${studentsData.length}-${Date.now()}`,
            classesHash: `${classesData.length}-${Date.now()}`,
          },
        },
      },
      performance: {
        responseTimeMs: processingTime,
        recordsPerSecond: totalRecords > 0 ? Math.round(totalRecords / (processingTime / 1000)) : 0,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    // Compress response if requested
    if (compress && totalRecords > 50) {
      try {
        const jsonString = JSON.stringify(response);
        const compressed = await gzipAsync(jsonString);
        
        return new NextResponse(Buffer.from(compressed), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'X-Response-Time': `${processingTime}ms`,
            'X-Records-Count': `${totalRecords}`,
            'X-Compression-Ratio': `${Math.round((compressed.length / jsonString.length) * 100)}%`,
          }
        });
      } catch (compressionError) {
        console.warn('Compression failed, sending uncompressed response:', compressionError);
        warnings.push('Compression failed, sending uncompressed response');
      }
    }

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${processingTime}ms`,
        'X-Records-Count': `${totalRecords}`,
        'X-Performance': `${response.performance.recordsPerSecond} records/sec`,
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Error in enhanced sync API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        performance: {
          responseTimeMs: processingTime,
          recordsPerSecond: 0,
        }
      },
      { status: 500 }
    );
  }
}

// POST endpoint for checking specific records by IDs (enhanced)
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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

    const apiKey = request.headers.get('X-API-Key')!;
    
    // Check rate limit
    if (!checkRateLimit(apiKey, 120)) { // Higher limit for POST as it's more specific
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded. Maximum 120 requests per minute for POST.' 
        },
        { status: 429 }
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

    // Validate input arrays
    if (studentIds && (!Array.isArray(studentIds) || studentIds.length > 100)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'studentIds must be an array with maximum 100 items' 
        },
        { status: 400 }
      );
    }

    if (classIds && (!Array.isArray(classIds) || classIds.length > 100)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'classIds must be an array with maximum 100 items' 
        },
        { status: 400 }
      );
    }

    const result: { students: SyncStudent[]; classes: SyncClass[] } = {
      students: [],
      classes: []
    };

    // Fetch specific students if requested (with parallel processing)
    if (studentIds && Array.isArray(studentIds)) {
      const studentPromises = studentIds.map(async (studentId) => {
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

            return {
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
            };
          }
          return null;
        } catch (error) {
          console.warn(`Error fetching student ${studentId}:`, error);
          return null;
        }
      });

      const studentResults = await Promise.all(studentPromises);
      result.students = studentResults.filter(s => s !== null) as SyncStudent[];
    }

    // Fetch specific classes if requested (with parallel processing)
    if (classIds && Array.isArray(classIds)) {
      const classPromises = classIds.map(async (classId) => {
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

            return {
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
            };
          }
          return null;
        } catch (error) {
          console.warn(`Error fetching class ${classId}:`, error);
          return null;
        }
      });

      const classResults = await Promise.all(classPromises);
      result.classes = classResults.filter(c => c !== null) as SyncClass[];
    }

    const processingTime = Date.now() - startTime;
    const totalRecords = result.students.length + result.classes.length;

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
          hasMoreData: false, // POST endpoint doesn't use pagination
          lastSyncTimestamp: new Date().toISOString(),
          serverTimestamp: new Date().toISOString(),
          dataIntegrity: {
            studentsHash: `${result.students.length}-${Date.now()}`,
            classesHash: `${result.classes.length}-${Date.now()}`,
          },
        },
      },
      performance: {
        responseTimeMs: processingTime,
        recordsPerSecond: totalRecords > 0 ? Math.round(totalRecords / (processingTime / 1000)) : 0,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${processingTime}ms`,
        'X-Records-Count': `${totalRecords}`,
        'X-Performance': `${response.performance.recordsPerSecond} records/sec`,
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Error in POST sync API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        performance: {
          responseTimeMs: processingTime,
          recordsPerSecond: 0,
        }
      },
      { status: 500 }
    );
  }
}
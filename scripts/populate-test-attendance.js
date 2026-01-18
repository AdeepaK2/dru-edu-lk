/**
 * Test Data Population Script
 * Adds historical class schedules with random attendance for testing
 * 
 * Usage: node scripts/populate-test-attendance.js
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const CLASS_ID = 'u30PIzQglhl753nlIq8b';
const STUDENT_ID = '0jTY9T5PY2Z9lSBDG5h9KiD3WSS2';
const STUDENT_NAME = 'Test Student';
const STUDENT_EMAIL = 'test.student@example.com';

// Initialize Firebase Admin
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  console.log('🔐 Initializing Firebase Admin...');
  console.log('   Project ID:', projectId);
  console.log('   Client Email:', clientEmail ? clientEmail.substring(0, 20) + '...' : 'NOT FOUND');
  console.log('   Private Key:', privateKey ? 'Found (' + privateKey.length + ' chars)' : 'NOT FOUND');

  if (!privateKey || !clientEmail) {
    console.error('❌ Missing Firebase Admin credentials!');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId: projectId,
      clientEmail: clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin initialized');
}

// Use the production database (matching the deployed web app)
// Mobile app uses EXPO_PUBLIC_FIRESTORE_DATABASE_ID=production
const databaseId = 'production';
console.log('   Database ID:', databaseId);
const db = getFirestore(databaseId);

// Generate random attendance status
function getRandomStatus() {
  const rand = Math.random();
  if (rand < 0.7) return 'present';
  if (rand < 0.85) return 'late';
  return 'absent';
}

// Generate dates for past weeks
function getPastWeekdays(weeksBack) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let week = 1; week <= weeksBack; week++) {
    for (const dayOfWeek of [1, 4]) { // Monday, Thursday
      const date = new Date(today);
      date.setDate(today.getDate() - (week * 7));
      const currentDay = date.getDay();
      const diff = currentDay >= dayOfWeek ? currentDay - dayOfWeek : 7 - (dayOfWeek - currentDay);
      date.setDate(date.getDate() - diff);
      date.setHours(16, 0, 0, 0);

      if (date < today) {
        dates.push(new Date(date));
      }
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

async function getClassDetails(classId) {
  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists) {
    throw new Error(`Class ${classId} not found`);
  }
  return { id: classDoc.id, ...classDoc.data() };
}

async function getExistingSchedules(classId) {
  const schedules = await db.collection('classSchedules')
    .where('classId', '==', classId)
    .get();

  const existingDates = new Set();
  schedules.forEach(doc => {
    const data = doc.data();
    if (data.scheduledDate) {
      const date = data.scheduledDate.toDate();
      existingDates.add(date.toDateString());
    }
  });

  return existingDates;
}

async function createScheduleWithAttendance(classData, date, studentId, studentName, studentEmail) {
  const status = getRandomStatus();

  const scheduleData = {
    classId: classData.id,
    className: classData.name || 'Test Class',
    subjectId: classData.subjectId || '',
    subjectName: classData.subject || 'Mathematics',
    teacherId: classData.teacherId || 'teacher-001',
    teacherName: classData.teacherName || 'Teacher',
    scheduledDate: Timestamp.fromDate(date),
    startTime: '16:00',
    endTime: '17:00',
    duration: 60,
    scheduleType: 'regular',
    mode: 'physical',
    status: 'completed',
    topic: `Class on ${date.toDateString()}`,
    description: 'Regular class session',
    location: 'Center Location',
    isRecurring: true,
    recurringPattern: 'weekly',
    attendance: {
      totalStudents: 1,
      presentCount: status === 'present' ? 1 : 0,
      absentCount: status === 'absent' ? 1 : 0,
      lateCount: status === 'late' ? 1 : 0,
      attendanceRate: status === 'absent' ? 0 : 100,
      students: [{
        studentId,
        studentName,
        studentEmail,
        status,
        markedAt: Timestamp.fromDate(date),
        markedBy: 'test-script'
      }],
      lastUpdatedAt: Timestamp.fromDate(date),
      lastUpdatedBy: 'test-script'
    },
    createdAt: Timestamp.fromDate(date),
    updatedAt: Timestamp.fromDate(date),
    createdBy: 'test-script',
    updatedBy: 'test-script'
  };

  const docRef = await db.collection('classSchedules').add(scheduleData);
  const statusEmoji = status === 'present' ? '✅' : status === 'late' ? '⏰' : '❌';
  console.log(`${statusEmoji} ${date.toDateString()} - ${status.toUpperCase()}`);
  return docRef.id;
}

async function main() {
  console.log('');
  console.log('🚀 Test Data Population Script');
  console.log('================================');
  console.log(`📋 Class ID: ${CLASS_ID}`);
  console.log(`👤 Student ID: ${STUDENT_ID}`);
  console.log('');

  try {
    console.log('📚 Fetching class details...');
    const classData = await getClassDetails(CLASS_ID);
    console.log(`✅ Found class: ${classData.name || 'Unnamed'}`);

    console.log('🔍 Checking existing schedules...');
    const existingDates = await getExistingSchedules(CLASS_ID);
    console.log(`📅 Found ${existingDates.size} existing schedules`);

    const pastDates = getPastWeekdays(8);
    console.log(`📆 Generated ${pastDates.length} potential dates`);

    const datesToCreate = pastDates.filter(date => !existingDates.has(date.toDateString()));
    console.log(`🆕 Will create ${datesToCreate.length} new schedules`);
    console.log('');

    if (datesToCreate.length === 0) {
      console.log('ℹ️ All dates already have schedules. Nothing to create.');
      return;
    }

    console.log('Creating schedules with random attendance:');
    console.log('');

    let created = 0;
    for (const date of datesToCreate) {
      await createScheduleWithAttendance(
        classData,
        date,
        STUDENT_ID,
        STUDENT_NAME,
        STUDENT_EMAIL
      );
      created++;
    }

    console.log('');
    console.log('================================');
    console.log(`🎉 Done! Created ${created} schedules.`);
    console.log('📊 Distribution: ~70% Present, ~15% Late, ~15% Absent');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().then(() => process.exit(0));

/**
 * Seed Data Script for student webservicesbyadeepa@gmail.com
 * Creates tests, submissions, homework, and attendance data
 * so the parent can visualize data in the mobile app.
 *
 * SAFE: Only adds data — never deletes. Only affects this student & their class.
 *
 * Usage: node scripts/seed-student-data.js
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Firebase Init ──────────────────────────────────────────────────────────

if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  console.log('Initializing Firebase Admin...');
  console.log('  Project ID:', projectId);
  console.log('  Client Email:', clientEmail ? clientEmail.substring(0, 25) + '...' : 'NOT FOUND');

  if (!privateKey || !clientEmail) {
    console.error('Missing Firebase Admin credentials!');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore('production');

// ─── Helpers ────────────────────────────────────────────────────────────────

const STUDENT_EMAIL = 'webservicesbyadeepa@gmail.com';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(16, 0, 0, 0);
  return d;
}

function ts(date) {
  return Timestamp.fromDate(date instanceof Date ? date : new Date(date));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Step 1: Find student & class ───────────────────────────────────────────

async function findStudent() {
  console.log(`\nLooking for student: ${STUDENT_EMAIL}`);

  const snap = await db.collection('students')
    .where('email', '==', STUDENT_EMAIL)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error(`Student with email ${STUDENT_EMAIL} not found`);
  }

  const doc = snap.docs[0];
  const data = doc.data();
  console.log(`  Found student: ${data.name || data.firstName + ' ' + data.lastName} (${doc.id})`);
  return { id: doc.id, ...data };
}

async function findEnrollments(studentId) {
  console.log(`\nLooking for enrollments for student ${studentId}...`);

  const snap = await db.collection('studentEnrollments')
    .where('studentId', '==', studentId)
    .get();

  if (snap.empty) {
    throw new Error(`No enrollments found for student ${studentId}`);
  }

  const enrollments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  Found ${enrollments.length} enrollment(s)`);
  return enrollments;
}

async function getClassInfo(classId) {
  const doc = await db.collection('classes').doc(classId).get();
  if (!doc.exists) throw new Error(`Class ${classId} not found`);
  return { id: doc.id, ...doc.data() };
}

// ─── Step 2: Check existing data ───────────────────────────────────────────

async function checkExistingTests(classId) {
  const snap = await db.collection('tests')
    .where('classIds', 'array-contains', classId)
    .get();
  return snap.size;
}

async function checkExistingSubmissions(studentId) {
  const snap = await db.collection('studentSubmissions')
    .where('studentId', '==', studentId)
    .get();
  return snap.size;
}

async function checkExistingHomework(classId) {
  const snap = await db.collection('studyMaterials')
    .where('classId', '==', classId)
    .where('isHomework', '==', true)
    .get();
  return snap.size;
}

async function checkExistingSchedules(classId) {
  const snap = await db.collection('classSchedules')
    .where('classId', '==', classId)
    .get();
  return snap.size;
}

// ─── Step 3: Create Tests ───────────────────────────────────────────────────

function generateMCQQuestions(subject, count) {
  const mathQuestions = [
    { text: 'What is 15 × 12?', options: ['170', '180', '190', '200'], correct: 1 },
    { text: 'Simplify: 3x + 5x - 2x', options: ['6x', '8x', '5x', '10x'], correct: 0 },
    { text: 'What is the square root of 144?', options: ['10', '11', '12', '14'], correct: 2 },
    { text: 'If y = 2x + 3, what is y when x = 4?', options: ['8', '11', '14', '7'], correct: 1 },
    { text: 'What is 25% of 200?', options: ['25', '40', '50', '75'], correct: 2 },
    { text: 'Solve: 2(x + 3) = 14', options: ['x = 3', 'x = 4', 'x = 5', 'x = 7'], correct: 1 },
    { text: 'What is the area of a triangle with base 10 and height 6?', options: ['30', '60', '16', '20'], correct: 0 },
    { text: 'Convert 0.75 to a fraction.', options: ['1/2', '2/3', '3/4', '4/5'], correct: 2 },
    { text: 'What is 8³?', options: ['64', '256', '512', '384'], correct: 2 },
    { text: 'Find the median of: 3, 7, 9, 12, 15', options: ['7', '9', '12', '9.2'], correct: 1 },
  ];

  const scienceQuestions = [
    { text: 'What is the chemical symbol for water?', options: ['HO', 'H2O', 'OH2', 'H2O2'], correct: 1 },
    { text: 'Which planet is closest to the Sun?', options: ['Venus', 'Mars', 'Mercury', 'Earth'], correct: 2 },
    { text: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi body'], correct: 1 },
    { text: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correct: 2 },
    { text: 'What is Newton\'s second law?', options: ['F = ma', 'E = mc²', 'V = IR', 'P = IV'], correct: 0 },
    { text: 'How many bones are in the adult human body?', options: ['186', '196', '206', '216'], correct: 2 },
    { text: 'What type of rock is formed from cooled lava?', options: ['Sedimentary', 'Metamorphic', 'Igneous', 'Mineral'], correct: 2 },
    { text: 'Which element has atomic number 6?', options: ['Nitrogen', 'Carbon', 'Oxygen', 'Boron'], correct: 1 },
    { text: 'What is the speed of light approximately?', options: ['300,000 m/s', '300,000 km/s', '30,000 km/s', '3,000,000 km/s'], correct: 1 },
    { text: 'What is the pH of pure water?', options: ['5', '6', '7', '8'], correct: 2 },
  ];

  const englishQuestions = [
    { text: 'Which is a synonym for "happy"?', options: ['Sad', 'Joyful', 'Angry', 'Tired'], correct: 1 },
    { text: 'Identify the noun: "The cat sat on the mat."', options: ['sat', 'on', 'the', 'cat'], correct: 3 },
    { text: 'What is the past tense of "run"?', options: ['Runned', 'Ran', 'Running', 'Runs'], correct: 1 },
    { text: 'Which sentence is correct?', options: ['Their going home.', 'They\'re going home.', 'There going home.', 'Theyre going home.'], correct: 1 },
    { text: 'What is an antonym of "ancient"?', options: ['Old', 'Modern', 'Historic', 'Vintage'], correct: 1 },
    { text: 'Identify the verb: "She quickly ran to school."', options: ['She', 'quickly', 'ran', 'school'], correct: 2 },
    { text: 'What literary device is "The wind whispered"?', options: ['Simile', 'Metaphor', 'Personification', 'Alliteration'], correct: 2 },
    { text: 'Which is a compound sentence?', options: ['I ran.', 'I ran and she walked.', 'Running fast.', 'The big dog.'], correct: 1 },
    { text: 'What is the plural of "child"?', options: ['Childs', 'Childes', 'Children', 'Childern'], correct: 2 },
    { text: 'Which word is an adverb?', options: ['Beautiful', 'Quickly', 'Happy', 'Blue'], correct: 1 },
  ];

  const subjectLower = (subject || 'math').toLowerCase();
  let pool;
  if (subjectLower.includes('math')) pool = mathQuestions;
  else if (subjectLower.includes('sci') || subjectLower.includes('phy') || subjectLower.includes('chem') || subjectLower.includes('bio')) pool = scienceQuestions;
  else if (subjectLower.includes('eng') || subjectLower.includes('lit')) pool = englishQuestions;
  else pool = mathQuestions;

  return pool.slice(0, count).map((q, i) => ({
    id: `q${i + 1}`,
    questionId: `q${i + 1}`,
    questionType: 'mcq',
    points: 1,
    order: i + 1,
    questionText: q.text,
    options: q.options,
    correctOption: q.correct,
    difficultyLevel: i < 3 ? 'easy' : i < 7 ? 'medium' : 'hard',
  }));
}

async function createTests(classInfo, studentInfo) {
  console.log('\nCreating tests...');

  const teacherId = classInfo.teacherId || 'teacher-001';
  const teacherName = classInfo.teacherName || 'Teacher';
  const subject = classInfo.subject || classInfo.subjectName || 'Mathematics';
  const subjectId = classInfo.subjectId || 'math-001';

  const testConfigs = [
    { title: `${subject} - Weekly Quiz 1`, daysAgoVal: 42, questionCount: 5, type: 'flexible' },
    { title: `${subject} - Weekly Quiz 2`, daysAgoVal: 35, questionCount: 5, type: 'flexible' },
    { title: `${subject} - Mid-Term Test`, daysAgoVal: 28, questionCount: 10, type: 'flexible' },
    { title: `${subject} - Weekly Quiz 3`, daysAgoVal: 21, questionCount: 5, type: 'flexible' },
    { title: `${subject} - Weekly Quiz 4`, daysAgoVal: 14, questionCount: 5, type: 'flexible' },
    { title: `${subject} - Practice Test`, daysAgoVal: 7, questionCount: 8, type: 'flexible' },
  ];

  const testIds = [];

  for (const config of testConfigs) {
    const questions = generateMCQQuestions(subject, config.questionCount);
    const createdDate = daysAgo(config.daysAgoVal);
    const availableFrom = daysAgo(config.daysAgoVal);
    const availableTo = daysAgo(config.daysAgoVal - 3);

    const testData = {
      title: config.title,
      description: `Auto-generated ${config.title.toLowerCase()} for class assessment.`,
      teacherId,
      teacherName,
      subjectId,
      subjectName: subject,
      assignmentType: 'class-based',
      classIds: [classInfo.id],
      classNames: [classInfo.name || 'Class'],
      totalAssignedStudents: 1,
      type: config.type,
      config: {
        questionSelectionMethod: 'manual',
        questionType: 'mcq',
        totalQuestions: config.questionCount,
        shuffleQuestions: false,
        allowReviewBeforeSubmit: true,
        passingScore: 50,
        showResultsImmediately: true,
      },
      questions,
      totalMarks: config.questionCount,
      status: 'completed',
      availableFrom: ts(availableFrom),
      availableTo: ts(availableTo),
      duration: 30,
      attemptsAllowed: 1,
      createdAt: ts(createdDate),
      updatedAt: ts(createdDate),
    };

    const ref = await db.collection('tests').add(testData);
    console.log(`  Created test: ${config.title} (${ref.id})`);
    testIds.push({ id: ref.id, ...config, questions });
  }

  return testIds;
}

// ─── Step 4: Create Submissions ─────────────────────────────────────────────

async function createSubmissions(tests, classInfo, studentInfo) {
  console.log('\nCreating student submissions...');

  const studentName = studentInfo.name || `${studentInfo.firstName || ''} ${studentInfo.lastName || ''}`.trim();

  for (const test of tests) {
    const totalQuestions = test.questionCount;
    // Vary performance: 60-100% correct
    const correctCount = randomBetween(Math.ceil(totalQuestions * 0.6), totalQuestions);
    const incorrectCount = totalQuestions - correctCount;

    const submittedDate = daysAgo(test.daysAgoVal - 1);
    const startDate = new Date(submittedDate);
    startDate.setMinutes(startDate.getMinutes() - randomBetween(10, 25));

    const finalAnswers = test.questions.map((q, i) => {
      const isCorrect = i < correctCount;
      const selectedOption = isCorrect ? q.correctOption : ((q.correctOption + 1) % 4);
      return {
        questionId: q.id,
        questionType: 'mcq',
        questionText: q.questionText,
        questionMarks: q.points,
        selectedOption,
        selectedOptionText: q.options[selectedOption],
        timeSpent: randomBetween(20, 120),
        changeCount: randomBetween(0, 2),
        wasReviewed: Math.random() > 0.5,
        isCorrect,
        marksAwarded: isCorrect ? q.points : 0,
      };
    });

    const mcqResults = test.questions.map((q, i) => {
      const isCorrect = i < correctCount;
      const selectedOption = isCorrect ? q.correctOption : ((q.correctOption + 1) % 4);
      return {
        questionId: q.id,
        questionText: q.questionText,
        selectedOption,
        selectedOptionText: q.options[selectedOption],
        correctOption: q.correctOption,
        correctOptionText: q.options[q.correctOption],
        isCorrect,
        marksAwarded: isCorrect ? q.points : 0,
        maxMarks: q.points,
        difficultyLevel: q.difficultyLevel,
      };
    });

    const totalTimeSpent = finalAnswers.reduce((sum, a) => sum + a.timeSpent, 0);
    const percentage = Math.round((correctCount / totalQuestions) * 100);

    const submissionData = {
      testId: test.id,
      testTitle: test.title,
      testType: test.type,
      studentId: studentInfo.id,
      studentName,
      studentEmail: STUDENT_EMAIL,
      classId: classInfo.id,
      className: classInfo.name || 'Class',
      attemptNumber: 1,
      status: 'submitted',
      startTime: ts(startDate),
      endTime: ts(submittedDate),
      submittedAt: ts(submittedDate),
      totalTimeSpent,
      finalAnswers,
      questionsAttempted: totalQuestions,
      questionsSkipped: 0,
      questionsReviewed: finalAnswers.filter(a => a.wasReviewed).length,
      totalChanges: finalAnswers.reduce((sum, a) => sum + a.changeCount, 0),
      autoGradedScore: correctCount,
      manualGradingPending: false,
      totalScore: correctCount,
      maxScore: totalQuestions,
      percentage,
      passStatus: percentage >= 50 ? 'passed' : 'failed',
      mcqResults,
      integrityReport: {
        tabSwitches: randomBetween(0, 2),
        disconnections: 0,
        suspiciousActivities: [],
        isIntegrityCompromised: false,
      },
      createdAt: ts(submittedDate),
      updatedAt: ts(submittedDate),
    };

    const ref = await db.collection('studentSubmissions').add(submissionData);
    console.log(`  Submission for "${test.title}": ${correctCount}/${totalQuestions} (${percentage}%) — ${ref.id}`);
  }
}

// ─── Step 5: Create Homework (Study Materials) ─────────────────────────────

async function createHomework(classInfo, studentInfo) {
  console.log('\nCreating homework assignments...');

  const teacherId = classInfo.teacherId || 'teacher-001';
  const subject = classInfo.subject || classInfo.subjectName || 'Mathematics';
  const subjectId = classInfo.subjectId || 'math-001';
  const studentName = studentInfo.name || `${studentInfo.firstName || ''} ${studentInfo.lastName || ''}`.trim();

  const homeworkItems = [
    { title: `${subject} - Week 1 Homework`, daysAgoVal: 42, week: 1, mark: 'Good' },
    { title: `${subject} - Week 2 Homework`, daysAgoVal: 35, week: 2, mark: 'Excellent' },
    { title: `${subject} - Week 3 Homework`, daysAgoVal: 28, week: 3, mark: 'Satisfactory' },
    { title: `${subject} - Week 4 Homework`, daysAgoVal: 21, week: 4, mark: 'Good' },
    { title: `${subject} - Week 5 Homework`, daysAgoVal: 14, week: 5, mark: 'Excellent' },
    { title: `${subject} - Week 6 Homework`, daysAgoVal: 7, week: 6, mark: null }, // not yet graded
  ];

  for (const hw of homeworkItems) {
    const createdDate = daysAgo(hw.daysAgoVal);
    const dueDate = daysAgo(hw.daysAgoVal - 5);

    const hwData = {
      title: hw.title,
      description: `Complete the assigned exercises for week ${hw.week}.`,
      classId: classInfo.id,
      subjectId,
      teacherId,
      week: hw.week,
      weekTitle: `Week ${hw.week}`,
      year: 2026,
      fileUrl: '',
      fileName: '',
      fileSize: 0,
      fileType: 'pdf',
      uploadedAt: ts(createdDate),
      dueDate: ts(dueDate),
      isRequired: true,
      isVisible: true,
      order: hw.week,
      tags: [subject.toLowerCase()],
      completedBy: [studentInfo.id],
      downloadCount: 0,
      viewCount: randomBetween(1, 5),
      isHomework: true,
      homeworkType: 'manual',
      manualInstruction: `Complete exercises ${hw.week * 5 - 4} to ${hw.week * 5} from the textbook.`,
      maxMarks: 10,
      allowLateSubmission: true,
      lateSubmissionDays: 2,
      createdAt: ts(createdDate),
      updatedAt: ts(createdDate),
    };

    const hwRef = await db.collection('studyMaterials').add(hwData);

    // Create submission for this homework
    const submittedDate = daysAgo(hw.daysAgoVal - 3);
    const submissionData = {
      id: studentInfo.id,
      studyMaterialId: hwRef.id,
      classId: classInfo.id,
      studentId: studentInfo.id,
      studentName,
      status: hw.mark ? 'approved' : 'submitted',
      files: [],
      message: 'Completed the homework.',
      submittedAt: ts(submittedDate),
      attemptNumber: 1,
      createdAt: ts(submittedDate),
      updatedAt: ts(submittedDate),
    };

    if (hw.mark) {
      submissionData.teacherMark = hw.mark;
      submissionData.numericMark = hw.mark === 'Excellent' ? 9 : hw.mark === 'Good' ? 7 : 5;
      submissionData.teacherRemarks = hw.mark === 'Excellent' ? 'Great work! Keep it up.' : hw.mark === 'Good' ? 'Well done.' : 'Satisfactory effort.';
      submissionData.markedAt = ts(daysAgo(hw.daysAgoVal - 4));
      submissionData.markedBy = teacherId;
    }

    await db.collection('studyMaterials').doc(hwRef.id)
      .collection('submissions').doc(studentInfo.id).set(submissionData);

    const gradeInfo = hw.mark ? ` — Graded: ${hw.mark}` : ' — Pending';
    console.log(`  ${hw.title}${gradeInfo} (${hwRef.id})`);
  }
}

// ─── Step 6: Create Attendance (Class Schedules) ────────────────────────────

async function createAttendance(classInfo, studentInfo) {
  console.log('\nCreating class schedules with attendance...');

  const teacherId = classInfo.teacherId || 'teacher-001';
  const teacherName = classInfo.teacherName || 'Teacher';
  const subject = classInfo.subject || classInfo.subjectName || 'Mathematics';
  const subjectId = classInfo.subjectId || 'math-001';
  const studentName = studentInfo.name || `${studentInfo.firstName || ''} ${studentInfo.lastName || ''}`.trim();

  // Check which dates already have schedules
  const existingSnap = await db.collection('classSchedules')
    .where('classId', '==', classInfo.id)
    .get();
  const existingDates = new Set();
  existingSnap.forEach(doc => {
    const d = doc.data();
    if (d.scheduledDate) {
      existingDates.add(d.scheduledDate.toDate().toDateString());
    }
  });

  // Generate 8 weeks of classes (2x per week: Monday & Thursday)
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let week = 1; week <= 8; week++) {
    for (const dayOfWeek of [1, 4]) { // Monday=1, Thursday=4
      const date = new Date(today);
      date.setDate(today.getDate() - (week * 7));
      const currentDay = date.getDay();
      const diff = currentDay >= dayOfWeek ? currentDay - dayOfWeek : 7 - (dayOfWeek - currentDay);
      date.setDate(date.getDate() - diff);
      date.setHours(16, 0, 0, 0);
      if (date < today && !existingDates.has(date.toDateString())) {
        dates.push(date);
      }
    }
  }

  dates.sort((a, b) => a - b);

  if (dates.length === 0) {
    console.log('  All dates already have schedules — skipping.');
    return;
  }

  let presentCount = 0, lateCount = 0, absentCount = 0;

  for (const date of dates) {
    // 75% present, 15% late, 10% absent
    const rand = Math.random();
    const status = rand < 0.75 ? 'present' : rand < 0.90 ? 'late' : 'absent';

    if (status === 'present') presentCount++;
    else if (status === 'late') lateCount++;
    else absentCount++;

    const scheduleData = {
      classId: classInfo.id,
      className: classInfo.name || 'Class',
      subjectId,
      subjectName: subject,
      teacherId,
      teacherName,
      scheduledDate: ts(date),
      startTime: '16:00',
      endTime: '17:00',
      duration: 60,
      scheduleType: 'regular',
      mode: 'physical',
      status: 'completed',
      topic: `${subject} - ${date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
      description: 'Regular class session',
      location: classInfo.location || 'Center',
      isRecurring: true,
      recurringPattern: 'weekly',
      attendance: {
        totalStudents: 1,
        presentCount: status === 'present' ? 1 : 0,
        absentCount: status === 'absent' ? 1 : 0,
        lateCount: status === 'late' ? 1 : 0,
        attendanceRate: status === 'absent' ? 0 : 100,
        students: [{
          studentId: studentInfo.id,
          studentName,
          studentEmail: STUDENT_EMAIL,
          status,
          markedAt: ts(date),
          markedBy: 'seed-script',
        }],
        lastUpdatedAt: ts(date),
        lastUpdatedBy: 'seed-script',
      },
      createdAt: ts(date),
      updatedAt: ts(date),
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
    };

    await db.collection('classSchedules').add(scheduleData);
  }

  console.log(`  Created ${dates.length} schedules: ${presentCount} present, ${lateCount} late, ${absentCount} absent`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('========================================');
  console.log(' Seed Data Script');
  console.log('========================================');

  try {
    // 1. Find student
    const student = await findStudent();

    // 2. Find enrollments & class
    const enrollments = await findEnrollments(student.id);
    const classId = enrollments[0].classId;
    const classInfo = await getClassInfo(classId);
    console.log(`  Class: ${classInfo.name || classInfo.className} (${classInfo.id})`);

    // 3. Check existing data
    console.log('\nChecking existing data...');
    const existingTests = await checkExistingTests(classInfo.id);
    const existingSubs = await checkExistingSubmissions(student.id);
    const existingHW = await checkExistingHomework(classInfo.id);
    const existingSched = await checkExistingSchedules(classInfo.id);
    console.log(`  Tests: ${existingTests}, Submissions: ${existingSubs}, Homework: ${existingHW}, Schedules: ${existingSched}`);

    // 4. Create tests + submissions
    const tests = await createTests(classInfo, student);
    await createSubmissions(tests, classInfo, student);

    // 5. Create homework
    await createHomework(classInfo, student);

    // 6. Create attendance
    await createAttendance(classInfo, student);

    console.log('\n========================================');
    console.log(' Seed complete!');
    console.log('========================================');
    console.log(`Student: ${student.name || student.firstName} (${student.id})`);
    console.log(`Class: ${classInfo.name || classInfo.className} (${classInfo.id})`);
    console.log('Created: 6 tests, 6 submissions, 6 homework items, ~16 attendance records');
    console.log('No existing data was deleted or modified.');

  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().then(() => process.exit(0));

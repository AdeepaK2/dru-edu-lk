// Read-only inspection of production retest data.
// Run from dru-edu/: node scripts/inspect-retests.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'production';
if (typeof db.settings === 'function' && DATABASE_ID !== '(default)') {
  try {
    db.settings({ databaseId: DATABASE_ID });
  } catch (_) {}
}

const fs = (projectId, dbId) => {
  const { Firestore } = require('@google-cloud/firestore');
  return new Firestore({
    projectId,
    databaseId: dbId,
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  });
};

async function main() {
  // Prefer @google-cloud/firestore so we can target the named database "production"
  const firestore = fs(process.env.FIREBASE_PROJECT_ID, DATABASE_ID);
  console.log(`Connected to project=${process.env.FIREBASE_PROJECT_ID} database=${DATABASE_ID}\n`);

  // 1) Retest tests
  console.log('── Retest tests (tests where isRetest == true) ──');
  const retestSnap = await firestore.collection('tests').where('isRetest', '==', true).get();
  console.log(`Total retest docs: ${retestSnap.size}\n`);

  const byCounterKey = new Map();
  const rows = [];
  retestSnap.forEach((doc) => {
    const t = doc.data();
    const classId = (t.classIds && t.classIds[0]) || '(none)';
    const subjectId = t.subjectId || '(none)';
    const counterKey = subjectId !== '(none)' ? `${classId}_${subjectId}` : classId;
    if (!byCounterKey.has(counterKey)) byCounterKey.set(counterKey, []);
    byCounterKey.get(counterKey).push({ id: doc.id, ...t });
    rows.push({
      id: doc.id,
      title: t.title,
      testNumber: t.testNumber ?? null,
      displayNumber: t.displayNumber ?? null,
      originalTestId: t.originalTestId ?? null,
      originalTestNumber: t.originalTestNumber ?? null,
      originalDisplayNumber: t.originalDisplayNumber ?? null,
      classId,
      subjectId,
      createdAt: t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toISOString() : null,
      isDeleted: t.isDeleted ?? false,
      status: t.status ?? null,
    });
  });

  rows.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  rows.forEach((r) => {
    console.log(
      `- ${r.id} | ${r.createdAt} | testNumber=${r.testNumber} | display="${r.displayNumber}" | original=#${r.originalTestNumber} (${r.originalTestId}) | class=${r.classId} | status=${r.status}${r.isDeleted ? ' DELETED' : ''}`
    );
    console.log(`    title: ${r.title}`);
  });

  // 2) Counter state for each affected (classId, subjectId) pair
  console.log('\n── class_test_counters for counters touched by retests ──');
  for (const [key, retests] of byCounterKey.entries()) {
    const counterRef = firestore.collection('class_test_counters').doc(key);
    const snap = await counterRef.get();
    if (!snap.exists) {
      console.log(`- ${key}: (counter doc missing)  [retest count: ${retests.length}]`);
      continue;
    }
    const c = snap.data();
    const maxRetestNumber = Math.max(...retests.map((r) => r.testNumber || 0));
    console.log(
      `- ${key}: currentTestNumber=${c.currentTestNumber} totalTestsCreated=${c.totalTestsCreated} [retests here: ${retests.length}, maxRetestNumber=${maxRetestNumber}]`
    );
  }

  // 3) How many normal tests exist per affected counter (for gap impact estimate)
  console.log('\n── Normal tests count per affected counter ──');
  for (const [key, retests] of byCounterKey.entries()) {
    const [classId, subjectId] = key.includes('_') ? key.split('_') : [key, null];
    let q = firestore.collection('tests').where('classIds', 'array-contains', classId);
    if (subjectId) q = q.where('subjectId', '==', subjectId);
    const all = await q.get();
    let total = 0;
    let normal = 0;
    let retestCount = 0;
    all.forEach((d) => {
      const t = d.data();
      if (t.isDeleted === true) return;
      total += 1;
      if (t.isRetest === true) retestCount += 1;
      else normal += 1;
    });
    console.log(
      `- ${key}: total=${total} normal=${normal} retests=${retestCount}`
    );
  }

  // 4) Retest requests summary
  console.log('\n── retest_requests summary ──');
  const reqSnap = await firestore.collection('retest_requests').get();
  let pending = 0, approved = 0, denied = 0;
  reqSnap.forEach((d) => {
    const r = d.data();
    if (r.status === 'pending') pending += 1;
    else if (r.status === 'approved') approved += 1;
    else if (r.status === 'denied') denied += 1;
  });
  console.log(
    `Total requests: ${reqSnap.size} | pending=${pending} approved=${approved} denied=${denied}`
  );

  // 5) test_number_assignments rows that belong to retests
  console.log('\n── test_number_assignments linked to retest testIds ──');
  const retestIds = new Set(rows.map((r) => r.id));
  const assignments = await firestore.collection('test_number_assignments').get();
  let linkedToRetest = 0;
  assignments.forEach((d) => {
    const a = d.data();
    if (a.testId && retestIds.has(a.testId)) linkedToRetest += 1;
  });
  console.log(`Assignments docs linked to a retest testId: ${linkedToRetest} / ${assignments.size} total`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// One-time production cleanup — removes all retake data created under the old
// "whole class gets access" logic.
//
// Collections touched (retake-related docs only — original tests are NEVER touched):
//   1. tests              — docs where isRetest == true
//   2. retest_requests    — all docs (the old request records)
//   3. testAttempts       — docs whose testId belongs to a retake test
//   4. studentSubmissions — docs whose testId belongs to a retake test
//
// Run from dru-edu/:
//   node scripts/cleanup-retakes.js           # dry run — prints what would be deleted
//   node scripts/cleanup-retakes.js --apply   # ACTUALLY DELETE — read the dry-run first
//
// The --apply flag is the only thing that enables writes.
// Review the dry-run output carefully before passing --apply.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Firestore } = require('@google-cloud/firestore');

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'production';

if (!PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env');
  process.exit(1);
}

const db = new Firestore({
  projectId: PROJECT_ID,
  databaseId: DATABASE_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

const banner = (label) => {
  console.log('\n' + '='.repeat(70));
  console.log(label);
  console.log('='.repeat(70));
};

// Firestore `in` queries are limited to 30 items per call.
async function getDocsByTestIds(collectionName, testIds) {
  const results = [];
  const chunks = [];
  for (let i = 0; i < testIds.length; i += 30) {
    chunks.push(testIds.slice(i, i + 30));
  }
  for (const chunk of chunks) {
    const snap = await db.collection(collectionName).where('testId', 'in', chunk).get();
    snap.forEach((doc) => results.push(doc.ref));
  }
  return results;
}

// Delete refs in batches of 500 (Firestore batch limit).
async function deleteRefs(refs) {
  const BATCH_SIZE = 500;
  let deleted = 0;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += refs.slice(i, i + BATCH_SIZE).length;
    console.log(`  deleted ${deleted} / ${refs.length}`);
  }
}

async function main() {
  console.log(`project  : ${PROJECT_ID}`);
  console.log(`database : ${DATABASE_ID}`);
  console.log(`mode     : ${APPLY ? '*** APPLY — writes ARE happening ***' : 'DRY RUN (no writes)'}`);

  // ── STEP 1: Load all retake tests ───────────────────────────────────────────
  banner('STEP 1 — Retake tests  (tests where isRetest == true)');
  const retakeSnap = await db.collection('tests').where('isRetest', '==', true).get();
  const retakeRefs = [];
  const retakeIds = [];

  retakeSnap.forEach((doc) => {
    const d = doc.data();
    retakeRefs.push(doc.ref);
    retakeIds.push(doc.id);
    console.log(`  ${doc.id}  title="${d.title}"  class=${(d.classIds || []).join(',')}  createdAt=${d.createdAt?.toDate?.()?.toISOString() ?? '?'}`);
  });
  console.log(`\nTotal retake test docs : ${retakeRefs.length}`);

  if (retakeRefs.length === 0) {
    console.log('Nothing to clean up — no retake tests found.');
    return;
  }

  // ── STEP 2: Load all retest_requests ────────────────────────────────────────
  banner('STEP 2 — Retest requests  (retest_requests collection — all docs)');
  const requestSnap = await db.collection('retest_requests').get();
  const requestRefs = [];
  requestSnap.forEach((doc) => {
    const d = doc.data();
    requestRefs.push(doc.ref);
    console.log(`  ${doc.id}  student="${d.studentName}"  test="${d.testTitle}"  status=${d.status}`);
  });
  console.log(`\nTotal retest_request docs : ${requestRefs.length}`);

  // ── STEP 3: testAttempts for retake testIds ──────────────────────────────────
  banner('STEP 3 — testAttempts whose testId belongs to a retake test');
  const attemptRefs = await getDocsByTestIds('testAttempts', retakeIds);
  console.log(`Total testAttempt docs to delete : ${attemptRefs.length}`);

  // ── STEP 4: studentSubmissions for retake testIds ───────────────────────────
  banner('STEP 4 — studentSubmissions whose testId belongs to a retake test');
  const submissionRefs = await getDocsByTestIds('studentSubmissions', retakeIds);
  console.log(`Total studentSubmission docs to delete : ${submissionRefs.length}`);

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  banner('SUMMARY');
  console.log(`  tests (isRetest==true)    : ${retakeRefs.length}`);
  console.log(`  retest_requests           : ${requestRefs.length}`);
  console.log(`  testAttempts              : ${attemptRefs.length}`);
  console.log(`  studentSubmissions        : ${submissionRefs.length}`);
  console.log(`  mode                      : ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  if (!APPLY) {
    console.log('\nNo writes performed. Re-run with --apply once you have reviewed the plan above.');
    return;
  }

  // ── APPLY ────────────────────────────────────────────────────────────────────
  banner('DELETING — studentSubmissions');
  await deleteRefs(submissionRefs);

  banner('DELETING — testAttempts');
  await deleteRefs(attemptRefs);

  banner('DELETING — retest_requests');
  await deleteRefs(requestRefs);

  banner('DELETING — retake tests');
  await deleteRefs(retakeRefs);

  banner('DONE');
  console.log(`Deleted:`);
  console.log(`  ${retakeRefs.length} retake tests`);
  console.log(`  ${requestRefs.length} retest_request docs`);
  console.log(`  ${attemptRefs.length} testAttempt docs`);
  console.log(`  ${submissionRefs.length} studentSubmission docs`);
  console.log('\nOriginal tests were NOT touched.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

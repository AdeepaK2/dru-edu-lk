// Legacy retest migration — DRY RUN ONLY by default.
//
// Purpose: clean up the 29 retests that were created under the old approach
// where retests consumed `class_test_counters` and got fake "Mathematics Test #N"
// display numbers. After the code change retests no longer touch the counter,
// so this script:
//   1. Wipes testNumber / displayNumber / numberAssignmentId on every retest doc.
//   2. Backs up the old values under `legacy.{testNumber,displayNumber,numberAssignmentId}`.
//   3. Backfills `originalTestTitle` / `originalTestNumber` / `originalDisplayNumber`
//      from the original test if those are null.
//   4. Lists every `class_test_counters` doc whose state is composed only of
//      retests so it can be deleted (counter docs are NOT touched in dry-run).
//   5. Lists every `test_number_assignments` doc that points at a retest test
//      so they can be deleted alongside the counter cleanup.
//
// Run from dru-edu/:
//   node scripts/migrate-legacy-retests.js              # dry run
//   node scripts/migrate-legacy-retests.js --apply      # ACTUALLY WRITE (do not pass without review)
//
// The --apply path is intentionally guarded — re-read the dry-run output and
// the affected document IDs before flipping it on.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Firestore, FieldValue } = require('@google-cloud/firestore');

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'production';

if (!PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env');
  process.exit(1);
}

const firestore = new Firestore({
  projectId: PROJECT_ID,
  databaseId: DATABASE_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

const banner = (label) => {
  console.log('\n' + '='.repeat(80));
  console.log(label);
  console.log('='.repeat(80));
};

const fmt = (val) => (val === undefined ? 'undefined' : JSON.stringify(val));

async function main() {
  console.log(`project=${PROJECT_ID} database=${DATABASE_ID}`);
  console.log(`mode=${APPLY ? 'APPLY (writes will happen!)' : 'DRY RUN (no writes)'}`);

  banner('STEP 1 — Load all retest tests');
  const retestSnap = await firestore.collection('tests').where('isRetest', '==', true).get();
  console.log(`Total retest docs: ${retestSnap.size}`);

  const retests = [];
  retestSnap.forEach((doc) => {
    retests.push({ id: doc.id, data: doc.data(), ref: doc.ref });
  });

  banner('STEP 2 — Per-retest planned changes');
  const counterKeysSeen = new Set();
  const planned = [];

  for (const r of retests) {
    const t = r.data;

    // Look up original test for backfill
    let original = null;
    if (t.originalTestId) {
      try {
        const origSnap = await firestore.collection('tests').doc(t.originalTestId).get();
        if (origSnap.exists) original = origSnap.data();
      } catch (_) {}
    }

    const update = {};
    const legacy = {};

    if (t.testNumber !== null && t.testNumber !== undefined) {
      legacy.testNumber = t.testNumber;
      update['testNumber'] = null;
    }
    if (t.displayNumber !== null && t.displayNumber !== undefined) {
      legacy.displayNumber = t.displayNumber;
      update['displayNumber'] = null;
    }
    if (t.numberAssignmentId !== null && t.numberAssignmentId !== undefined) {
      legacy.numberAssignmentId = t.numberAssignmentId;
      update['numberAssignmentId'] = null;
    }

    if (Object.keys(legacy).length > 0) {
      update['legacy'] = legacy;
    }

    if ((t.originalTestTitle === null || t.originalTestTitle === undefined) && original?.title) {
      update['originalTestTitle'] = original.title;
    }
    if ((t.originalTestNumber === null || t.originalTestNumber === undefined) && original?.testNumber !== undefined && original?.testNumber !== null) {
      update['originalTestNumber'] = original.testNumber;
    }
    if ((t.originalDisplayNumber === null || t.originalDisplayNumber === undefined) && original?.displayNumber) {
      update['originalDisplayNumber'] = original.displayNumber;
    }

    update['migratedAt'] = APPLY ? FieldValue.serverTimestamp() : 'serverTimestamp()';

    const classId = (t.classIds && t.classIds[0]) || null;
    const subjectId = t.subjectId || null;
    const counterKey = subjectId && classId ? `${classId}_${subjectId}` : classId;
    if (counterKey) counterKeysSeen.add(counterKey);

    planned.push({ id: r.id, ref: r.ref, current: t, update, originalFound: !!original });

    console.log(`\n- ${r.id}`);
    console.log(`  title         : ${t.title}`);
    console.log(`  classId       : ${classId}  subjectId: ${subjectId}`);
    console.log(`  counterKey    : ${counterKey}`);
    console.log(`  current       : testNumber=${fmt(t.testNumber)} displayNumber=${fmt(t.displayNumber)} numberAssignmentId=${fmt(t.numberAssignmentId)}`);
    console.log(`  original ref  : ${t.originalTestId || '(none)'}  found=${!!original}`);
    console.log(`  will write    :`);
    Object.entries(update).forEach(([k, v]) => {
      console.log(`    ${k} = ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`);
    });
  }

  banner('STEP 3 — class_test_counters audit');
  const counterDeletePlan = [];
  for (const key of counterKeysSeen) {
    const counterRef = firestore.collection('class_test_counters').doc(key);
    const snap = await counterRef.get();
    if (!snap.exists) {
      console.log(`- ${key}: (counter doc missing — nothing to do)`);
      continue;
    }
    const c = snap.data();
    // How many normal vs retest tests live under this counter?
    const [classId, subjectId] = key.includes('_') ? key.split('_') : [key, null];
    let q = firestore.collection('tests').where('classIds', 'array-contains', classId);
    if (subjectId) q = q.where('subjectId', '==', subjectId);
    const all = await q.get();
    let normal = 0;
    let retest = 0;
    all.forEach((d) => {
      const td = d.data();
      if (td.isDeleted === true) return;
      if (td.isRetest === true) retest += 1;
      else normal += 1;
    });
    console.log(`- ${key}`);
    console.log(`    counter      : currentTestNumber=${c.currentTestNumber} totalTestsCreated=${c.totalTestsCreated}`);
    console.log(`    population   : normalTests=${normal} retests=${retest}`);
    if (normal === 0) {
      console.log(`    plan         : DELETE counter doc (only retests live here)`);
      counterDeletePlan.push(counterRef);
    } else {
      // Normal tests exist under this counter — which means at least one path
      // (UseTemplateModal / enhancedTestService) wrote here. RESET instead of DELETE.
      console.log(`    plan         : RESET counter (currentTestNumber=1, totalTestsCreated=0) — normal tests present`);
      counterDeletePlan.push({ ref: counterRef, reset: true });
    }
  }

  banner('STEP 4 — test_number_assignments audit');
  const retestIds = new Set(planned.map((p) => p.id));
  const assignmentSnap = await firestore.collection('test_number_assignments').get();
  const assignmentDeletePlan = [];
  let unrelated = 0;
  assignmentSnap.forEach((doc) => {
    const a = doc.data();
    if (a.testId && retestIds.has(a.testId)) {
      assignmentDeletePlan.push(doc.ref);
    } else {
      unrelated += 1;
    }
  });
  console.log(`assignments linked to a retest testId : ${assignmentDeletePlan.length}`);
  console.log(`assignments NOT linked to a retest    : ${unrelated}`);
  console.log(`plan: delete the ${assignmentDeletePlan.length} retest-linked assignment docs`);

  banner('SUMMARY');
  console.log(`Retest test docs to update     : ${planned.length}`);
  console.log(`class_test_counters touched    : ${counterDeletePlan.length}`);
  console.log(`test_number_assignments to del : ${assignmentDeletePlan.length}`);
  console.log(`mode                           : ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  if (!APPLY) {
    console.log('\nNo writes performed. Re-run with --apply once you have reviewed the plan above.');
    return;
  }

  banner('APPLYING WRITES');

  // 1. Update each retest doc
  for (const p of planned) {
    await p.ref.update(p.update);
    console.log(`updated ${p.id}`);
  }

  // 2. Counters
  for (const item of counterDeletePlan) {
    if (item && item.reset) {
      await item.ref.update({
        currentTestNumber: 1,
        totalTestsCreated: 0,
        updatedAt: FieldValue.serverTimestamp(),
        lastResetAt: FieldValue.serverTimestamp(),
      });
      console.log(`reset counter ${item.ref.id}`);
    } else {
      await item.delete();
      console.log(`deleted counter ${item.id}`);
    }
  }

  // 3. Assignment docs
  for (const ref of assignmentDeletePlan) {
    await ref.delete();
    console.log(`deleted assignment ${ref.id}`);
  }

  console.log('\nAll writes complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

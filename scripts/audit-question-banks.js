require('dotenv').config({ path: '.env' });
const fs = require('fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const sa = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/' + process.env.FIREBASE_CLIENT_EMAIL,
};

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
const db = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || '(default)');
const CHUNK = 300;

function parseLabel(title) {
  const m = String(title || '').trim().toUpperCase().match(/^([ME])(\d+)$/);
  return m ? { p: m[1], n: Number(m[2]) } : null;
}

function summarizeSeries(nums) {
  if (!nums.length) return { min: null, max: null, missing: [] };
  const uniq = Array.from(new Set(nums)).sort((a, b) => a - b);
  const set = new Set(uniq);
  const missing = [];
  for (let i = uniq[0]; i <= uniq[uniq.length - 1]; i++) {
    if (!set.has(i)) missing.push(i);
  }
  return { min: uniq[0], max: uniq[uniq.length - 1], missing };
}

(async () => {
  const bankSnaps = await db.collection('questionBanks').get();
  const report = [];

  for (const bankDoc of bankSnaps.docs) {
    const b = bankDoc.data() || {};
    const ids = Array.isArray(b.questionIds) ? b.questionIds : [];
    if (!ids.length) continue;

    const docs = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const refs = ids.slice(i, i + CHUNK).map(id => db.collection('questions').doc(id));
      docs.push(...(await db.getAll(...refs)));
    }

    const seen = { M: new Map(), E: new Map() };
    const values = { M: [], E: [] };

    for (const s of docs) {
      if (!s.exists) continue;
      const d = s.data() || {};
      const x = parseLabel(d.title);
      if (!x) continue;
      values[x.p].push(x.n);
      if (!seen[x.p].has(x.n)) seen[x.p].set(x.n, []);
      seen[x.p].get(x.n).push(s.id);
    }

    const duplicateM = Array.from(seen.M.entries()).filter(([, v]) => v.length > 1).map(([n, v]) => ({ n, ids: v })).sort((a, b) => a.n - b.n);
    const duplicateE = Array.from(seen.E.entries()).filter(([, v]) => v.length > 1).map(([n, v]) => ({ n, ids: v })).sort((a, b) => a.n - b.n);
    const seqM = summarizeSeries(values.M);
    const seqE = summarizeSeries(values.E);

    if (duplicateM.length || duplicateE.length || seqM.missing.length || seqE.missing.length) {
      report.push({
        bankId: bankDoc.id,
        bankName: b.name || '',
        subject: b.subjectName || '',
        totalQuestionIds: ids.length,
        duplicateM,
        duplicateE,
        missingMCount: seqM.missing.length,
        missingECount: seqE.missing.length,
        missingMSample: seqM.missing.slice(0, 20),
        missingESample: seqE.missing.slice(0, 20),
        mRange: seqM.min === null ? null : [seqM.min, seqM.max],
        eRange: seqE.min === null ? null : [seqE.min, seqE.max],
      });
    }
  }

  report.sort((a, b) => (b.duplicateM.length + b.duplicateE.length + b.missingMCount + b.missingECount) - (a.duplicateM.length + a.duplicateE.length + a.missingMCount + a.missingECount));

  const out = {
    project: process.env.FIREBASE_PROJECT_ID,
    database: process.env.FIRESTORE_DATABASE_ID || '(default)',
    banksScanned: bankSnaps.size,
    banksWithIssues: report.length,
    report,
  };

  fs.writeFileSync('/tmp/question-bank-audit.json', JSON.stringify(out, null, 2));

  console.log(JSON.stringify({
    project: out.project,
    database: out.database,
    banksScanned: out.banksScanned,
    banksWithIssues: out.banksWithIssues,
    reportFile: '/tmp/question-bank-audit.json',
    top10: out.report.slice(0, 10).map(b => ({
      bankId: b.bankId,
      bankName: b.bankName,
      duplicateM: b.duplicateM.map(x => x.n),
      duplicateE: b.duplicateE.map(x => x.n),
      missingMCount: b.missingMCount,
      missingECount: b.missingECount,
      missingMSample: b.missingMSample.slice(0, 10),
      missingESample: b.missingESample.slice(0, 10),
    })),
  }, null, 2));
})().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e);
  process.exit(1);
});

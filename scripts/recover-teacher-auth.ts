import * as admin from 'firebase-admin';
import firebaseAdmin from '../src/utils/firebase-server';

function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];

  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

function parseArgs(argv: string[]) {
  const args = {
    email: '',
    tempPassword: '',
    resetPassword: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--email' && argv[i + 1]) {
      args.email = argv[i + 1].trim();
      i += 1;
      continue;
    }

    if (arg === '--temp-password' && argv[i + 1]) {
      args.tempPassword = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--reset-password') {
      args.resetPassword = true;
      continue;
    }
  }

  return args;
}

async function findTeacherByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const emailVariants = Array.from(new Set([email.trim(), normalizedEmail]));

  const snapshots = await Promise.all(
    emailVariants.map((candidateEmail) =>
      firebaseAdmin.db.collection('teachers').where('email', '==', candidateEmail).limit(1).get()
    )
  );

  const matchingDocs = snapshots
    .flatMap((snapshot) => snapshot.docs)
    .reduce((acc, doc) => {
      if (!acc.some((existing) => existing.id === doc.id)) {
        acc.push(doc);
      }
      return acc;
    }, [] as admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[]);

  return matchingDocs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error('Usage: npx ts-node scripts/recover-teacher-auth.ts --email <teacher-email> [--temp-password <password>] [--reset-password]');
    process.exit(1);
  }

  const teacherDocs = await findTeacherByEmail(args.email);

  if (teacherDocs.length === 0) {
    console.error(`No teacher profile found for email: ${args.email}`);
    process.exit(1);
  }

  if (teacherDocs.length > 1) {
    console.error(`Multiple teacher profiles found for ${args.email}. Resolve duplicates first:`);
    teacherDocs.forEach((doc) => {
      const data = doc.data();
      console.error(`- uid=${doc.id}, name=${data.name || 'N/A'}, email=${data.email || 'N/A'}`);
    });
    process.exit(1);
  }

  const teacherDoc = teacherDocs[0];
  const teacherData = teacherDoc.data() as Record<string, any>;
  const teacherUid = teacherDoc.id;
  const teacherName = (teacherData.name as string | undefined)?.trim() || 'Teacher';
  const teacherEmail = ((teacherData.email as string | undefined) || args.email).trim().toLowerCase();

  let authUser: admin.auth.UserRecord | null = null;

  try {
    authUser = await firebaseAdmin.authentication.getUser(teacherUid);
    console.log(`Auth user already exists for UID ${teacherUid}`);
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }
    console.log(`Auth user missing for UID ${teacherUid}. Recreating account...`);
  }

  let generatedPassword = '';

  if (!authUser) {
    try {
      const emailOwner = await firebaseAdmin.authentication.getUserByEmail(teacherEmail);
      if (emailOwner.uid !== teacherUid) {
        console.error(`Email ${teacherEmail} is already used by a different UID: ${emailOwner.uid}`);
        process.exit(1);
      }
      authUser = emailOwner;
      console.log(`Found matching Auth user by email with UID ${teacherUid}`);
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }

      generatedPassword = args.tempPassword || generateRandomPassword();
      authUser = await firebaseAdmin.auth.createUser({
        uid: teacherUid,
        email: teacherEmail,
        password: generatedPassword,
        displayName: teacherName,
      });
      console.log(`Created Auth user for teacher UID ${teacherUid}`);
    }
  }

  if (authUser.email?.toLowerCase() !== teacherEmail || authUser.displayName !== teacherName) {
    await firebaseAdmin.authentication.updateUser(teacherUid, {
      email: teacherEmail,
      displayName: teacherName,
    });
    console.log('Updated Auth email/displayName to match teacher profile.');
  }

  if (args.resetPassword) {
    generatedPassword = args.tempPassword || generateRandomPassword();
    await firebaseAdmin.authentication.updateUser(teacherUid, {
      password: generatedPassword,
    });
    console.log('Password was reset as requested.');
  }

  const existingClaims = authUser.customClaims || {};
  const mergedClaims: Record<string, any> = { ...existingClaims };
  delete mergedClaims.student;

  mergedClaims.teacher = true;
  mergedClaims.role = 'teacher';

  await firebaseAdmin.authentication.setCustomClaims(teacherUid, mergedClaims);

  await firebaseAdmin.firestore.updateDoc('teachers', teacherUid, {
    email: teacherEmail,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log('\nTeacher auth recovery completed successfully.');
  console.log(`UID: ${teacherUid}`);
  console.log(`Email: ${teacherEmail}`);

  if (generatedPassword) {
    console.log(`Temporary password: ${generatedPassword}`);
  } else {
    console.log('Password unchanged. Use current password or perform a reset if needed.');
  }
}

main().catch((error) => {
  console.error('Recovery failed:', error);
  process.exit(1);
});

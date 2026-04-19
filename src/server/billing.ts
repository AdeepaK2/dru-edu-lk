import 'server-only';

import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { randomBytes } from 'crypto';
import { firebaseAdmin } from '@/utils/firebase-server';
import { sendGenericEmail, sendStudentWelcomeEmail } from '@/utils/emailService';
import {
  BILLING_COLLECTIONS,
  BillingInvoiceDocument,
  BillingLineItem,
  BillingPaymentDocument,
  BillingSettings,
  BillingSettingsDocument,
  DEFAULT_BILLING_SETTINGS,
  ParentPortalEntitlementDocument,
} from '@/models/billingSchema';
import {
  buildBillingLineItem,
  getBillingFeeDefinition,
  getBillingInvoiceTotal,
  hasBillingFee,
} from '@/server/billing-fees';
import type { EnrollmentRequestDocument } from '@/models/enrollmentRequestSchema';
import type { StudentDocument } from '@/models/studentSchema';
type FirestoreData = Record<string, unknown>;

const ONE_YEAR_DAYS = 365;

function nowTimestamp() {
  return admin.firestore.Timestamp.now();
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return undefined;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function ensureStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('Stripe is not configured: missing STRIPE_SECRET_KEY');
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-07-30.basil',
  });
}

function getSiteUrl(origin?: string) {
  return (
    origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function getMobileInviteBaseUrl() {
  return (process.env.MOBILE_APP_URL || 'druedu://').replace(/\/$/, '');
}

function buildInvoiceNumber() {
  const year = new Date().getFullYear();
  const suffix = `${Date.now()}`.slice(-6);
  return `BILL-${year}-${suffix}`;
}

function buildInvoiceToken() {
  return randomBytes(24).toString('hex');
}

function buildInvoiceUrl(token: string, origin?: string) {
  return `${getSiteUrl(origin)}/pay/${token}`;
}

function buildInviteLink(token: string) {
  return `${getMobileInviteBaseUrl()}accept-invite?token=${token}`;
}

async function getSettingsSnapshot() {
  return firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.SETTINGS)
    .doc('global')
    .get();
}

export async function getBillingSettings(): Promise<BillingSettingsDocument> {
  const snapshot = await getSettingsSnapshot();
  if (!snapshot.exists) {
    return {
      ...DEFAULT_BILLING_SETTINGS,
      updatedAt: new Date(0).toISOString(),
    };
  }

  return {
    ...DEFAULT_BILLING_SETTINGS,
    ...(snapshot.data() as Partial<BillingSettingsDocument>),
  } as BillingSettingsDocument;
}

export async function saveBillingSettings(
  settings: BillingSettings,
  updatedBy?: string,
): Promise<BillingSettingsDocument> {
  const payload: BillingSettingsDocument = {
    ...DEFAULT_BILLING_SETTINGS,
    ...settings,
    updatedAt: nowTimestamp(),
    updatedBy,
  };

  await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.SETTINGS)
    .doc('global')
    .set(payload, { merge: true });

  return payload;
}

export async function getBillingInvoiceByToken(token: string): Promise<BillingInvoiceDocument | null> {
  const snapshot = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.INVOICES)
    .where('invoiceToken', '==', token)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...(snapshot.docs[0].data() as Omit<BillingInvoiceDocument, 'id'>),
  };
}

export async function getBillingInvoiceById(invoiceId: string): Promise<BillingInvoiceDocument | null> {
  const snapshot = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.INVOICES)
    .doc(invoiceId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<BillingInvoiceDocument, 'id'>),
  };
}

async function getEnrollmentRequest(
  enrollmentRequestId: string,
): Promise<(EnrollmentRequestDocument & { id: string }) | null> {
  const snapshot = await firebaseAdmin.db
    .collection('enrollmentRequests')
    .doc(enrollmentRequestId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<EnrollmentRequestDocument, 'id'>),
  };
}

async function getStudentByEmail(email: string): Promise<(StudentDocument & { id: string }) | null> {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await firebaseAdmin.db
    .collection('students')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...(snapshot.docs[0].data() as Omit<StudentDocument, 'id'>),
  };
}

async function getStudentById(studentId: string): Promise<(StudentDocument & { id: string }) | null> {
  const snapshot = await firebaseAdmin.db.collection('students').doc(studentId).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<StudentDocument, 'id'>),
  };
}

async function getParentByEmail(email: string): Promise<(FirestoreData & { id: string }) | null> {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await firebaseAdmin.db
    .collection('parents')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...(snapshot.docs[0].data() as FirestoreData),
  };
}

export async function getParentPortalEntitlementByEmail(
  email: string,
): Promise<ParentPortalEntitlementDocument | null> {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.PARENT_PORTAL_ENTITLEMENTS)
    .doc(normalizedEmail)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as ParentPortalEntitlementDocument;
}

function isEntitlementActive(entitlement: ParentPortalEntitlementDocument | null) {
  if (!entitlement || entitlement.status !== 'active') {
    return false;
  }

  const endAt = toDate(entitlement.endAt);
  return Boolean(endAt && endAt.getTime() > Date.now());
}

async function sendInvoiceEmail(invoice: BillingInvoiceDocument) {
  const dueAt = toDate(invoice.dueAt);
  const feeLabels = invoice.lineItems.map((item) => item.label).join(', ');
  const lineItemsHtml = invoice.lineItems
    .map(
      (item) =>
        `<li><strong>${item.label}</strong>: ${formatCurrency(item.amount)} x ${item.quantity}</li>`,
    )
    .join('');

  const supportLine = process.env.SMTP_FROM_EMAIL
    ? `<p>If you need help, reply to this email or contact ${process.env.SMTP_FROM_EMAIL}.</p>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #111827;">
      <h1 style="color: #1d4ed8;">DRU EDU Payment Request</h1>
      <p>Hello ${invoice.parentName || 'Parent'},</p>
      <p>DRU EDU has generated a payment request for <strong>${feeLabels}</strong>.</p>
      <p><strong>Invoice:</strong> ${invoice.invoiceNumber}</p>
      <p><strong>Due date:</strong> ${dueAt ? dueAt.toLocaleDateString('en-AU') : 'As soon as possible'}</p>
      ${invoice.studentName ? `<p><strong>Student:</strong> ${invoice.studentName}</p>` : ''}
      <ul>${lineItemsHtml}</ul>
      <p><strong>Total:</strong> ${formatCurrency(invoice.amountTotal)}</p>
      <div style="margin: 28px 0;">
        <a href="${invoice.paymentUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">
          Pay Securely with Card
        </a>
      </div>
      <p>After payment is confirmed, DRU EDU will update your billing status automatically.</p>
      ${supportLine}
    </div>
  `;

  return sendGenericEmail(
    invoice.parentEmail,
    `DRU EDU invoice ${invoice.invoiceNumber}`,
    html,
  );
}

async function sendInvoiceEmailAndStamp(invoice: BillingInvoiceDocument) {
  const emailResult = await sendInvoiceEmail(invoice);

  if (emailResult.success) {
    await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoice.id).set(
      {
        emailSentAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      },
      { merge: true },
    );
  }

  return emailResult;
}

async function sendParentInviteEmail(
  parentEmail: string,
  parentName: string,
  studentNames: string[],
  inviteLink: string,
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #111827;">
      <h1 style="color: #1d4ed8;">Welcome to DRU EDU Parent Portal</h1>
      <p>Hello ${parentName || 'Parent'},</p>
      <p>Your payment has been confirmed. You can now activate your parent portal account for ${studentNames.join(', ')}.</p>
      <div style="margin: 28px 0;">
        <a href="${inviteLink}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">
          Set Up Parent Portal
        </a>
      </div>
      <p>If you are opening this email on a desktop device, copy the link to your phone and open it there.</p>
    </div>
  `;

  return sendGenericEmail(
    parentEmail,
    'DRU EDU parent portal invite',
    html,
  );
}

function generateRandomPassword(length = 10) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = 'A';
  password += 'a';
  password += '1';
  password += '!';

  for (let i = 4; i < length; i += 1) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

async function generateStudentNumber() {
  const counterRef = firebaseAdmin.db.collection('counters').doc('studentNumber');
  const counterSnapshot = await counterRef.get();

  let nextNumber = 1;
  if (counterSnapshot.exists) {
    const current = counterSnapshot.data() as { count?: number } | undefined;
    if (typeof current?.count === 'number') {
      nextNumber = current.count + 1;
    }
  }

  await counterRef.set(
    {
      count: nextNumber,
      lastUpdated: nowTimestamp(),
    },
    { merge: true },
  );

  return `ST${nextNumber.toString().padStart(4, '0')}`;
}

async function createStudentFromEnrollmentRequest(
  request: EnrollmentRequestDocument & { id: string },
): Promise<string> {
  const studentEmail = normalizeEmail(request.student.email);
  const existingStudent = await getStudentByEmail(studentEmail);
  if (existingStudent) {
    return existingStudent.id;
  }

  const generatedPassword = generateRandomPassword();
  const initials = request.student.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  let userRecord: admin.auth.UserRecord;
  try {
    const authUser = await firebaseAdmin.authentication.getUserByEmail(studentEmail);
    const studentDoc = await firebaseAdmin.firestore.getDoc('students', authUser.uid);
    if (studentDoc) {
      return authUser.uid;
    }

    userRecord = await firebaseAdmin.authentication.updateUser(authUser.uid, {
      password: generatedPassword,
      displayName: request.student.name,
    });
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }

    userRecord = await firebaseAdmin.authentication.createUser(
      studentEmail,
      generatedPassword,
      request.student.name,
    );
  }

  await firebaseAdmin.authentication.setCustomClaims(userRecord.uid, {
    student: true,
    role: 'student',
  });

  const studentNumber = await generateStudentNumber();

  const studentDocument: FirestoreData = {
    name: request.student.name,
    email: studentEmail,
    phone: request.student.phone,
    dateOfBirth: request.student.dateOfBirth,
    year: request.student.year,
    school: request.student.school,
    enrollmentDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    coursesEnrolled: 0,
    avatar: initials,
    studentNumber,
    parent: {
      name: request.parent.name,
      email: normalizeEmail(request.parent.email),
      phone: request.parent.phone,
    },
    payment: {
      status: 'Paid',
      method: 'stripe',
      lastPayment: new Date().toISOString().split('T')[0],
    },
    uid: userRecord.uid,
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };

  await firebaseAdmin.firestore.setDoc('students', userRecord.uid, studentDocument);
  await sendStudentWelcomeEmail(studentEmail, request.student.name, generatedPassword);

  return userRecord.uid;
}

async function ensureStudentEnrollment(
  studentId: string,
  request: EnrollmentRequestDocument & { id: string },
) {
  const existingEnrollment = await firebaseAdmin.db
    .collection('studentEnrollments')
    .where('studentId', '==', studentId)
    .where('classId', '==', request.classId)
    .limit(1)
    .get();

  if (!existingEnrollment.empty) {
    return existingEnrollment.docs[0].id;
  }

  const enrollmentRef = await firebaseAdmin.db.collection('studentEnrollments').add({
    studentId,
    classId: request.classId,
    studentName: request.student.name,
    studentEmail: normalizeEmail(request.student.email),
    className: request.className,
    subject: request.subject,
    enrolledAt: nowTimestamp(),
    status: 'Active',
    attendance: 0,
    notes: request.additionalNotes || '',
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  });

  const activeEnrollmentSnapshot = await firebaseAdmin.db
    .collection('studentEnrollments')
    .where('studentId', '==', studentId)
    .where('status', '==', 'Active')
    .get();

  await firebaseAdmin.firestore.updateDoc('students', studentId, {
    coursesEnrolled: activeEnrollmentSnapshot.size,
    payment: {
      status: 'Paid',
      method: 'stripe',
      lastPayment: new Date().toISOString().split('T')[0],
    },
    updatedAt: nowTimestamp(),
  });

  return enrollmentRef.id;
}

async function upsertParentInviteForStudent(
  request: EnrollmentRequestDocument & { id: string },
  studentId: string,
) {
  const parentEmail = normalizeEmail(request.parent.email);
  const existingParent = await getParentByEmail(parentEmail);

  if (existingParent) {
    const linkedStudents = Array.isArray(existingParent.linkedStudents)
      ? existingParent.linkedStudents
      : [];
    const alreadyLinked = linkedStudents.some(
      (student: { studentId?: string }) => student.studentId === studentId,
    );

    if (!alreadyLinked) {
      linkedStudents.push({
        studentId,
        studentName: request.student.name,
        studentEmail: normalizeEmail(request.student.email),
        relationship: 'guardian',
        isPrimary: linkedStudents.length === 0,
        linkedAt: new Date(),
      });

      await firebaseAdmin.db.collection('parents').doc(existingParent.id).update({
        linkedStudents,
        updatedAt: nowTimestamp(),
      });
    }

    return { created: false, inviteLink: null };
  }

  const pendingInviteSnapshot = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.PARENT_INVITES)
    .where('parentEmail', '==', parentEmail)
    .where('inviteStatus', '==', 'pending')
    .limit(1)
    .get();

  const studentEntry = {
    id: studentId,
    name: request.student.name,
    email: normalizeEmail(request.student.email),
    className: request.className,
  };

  if (!pendingInviteSnapshot.empty) {
    const pendingDoc = pendingInviteSnapshot.docs[0];
    const pendingData = pendingDoc.data() as {
      inviteToken: string;
      studentIds?: string[];
      students?: Array<{ id: string; name: string; email: string; className?: string }>;
    };

    const studentIds = new Set(pendingData.studentIds || []);
    studentIds.add(studentId);

    const students = [...(pendingData.students || [])];
    if (!students.some((student) => student.id === studentId)) {
      students.push(studentEntry);
    }

    await pendingDoc.ref.update({
      studentIds: [...studentIds],
      students,
      updatedAt: nowTimestamp(),
    });

    const inviteLink = buildInviteLink(pendingData.inviteToken);
    await sendParentInviteEmail(parentEmail, request.parent.name, students.map((student) => student.name), inviteLink);
    return { created: false, inviteLink };
  }

  const inviteToken = randomBytes(32).toString('hex');
  const expiresAt = addDays(new Date(), 7);
  const inviteLink = buildInviteLink(inviteToken);

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.PARENT_INVITES).add({
    parentEmail,
    parentName: request.parent.name,
    parentPhone: request.parent.phone,
    studentIds: [studentId],
    students: [studentEntry],
    inviteToken,
    invitedBy: 'billing-system',
    invitedByName: 'Billing System',
    inviteStatus: 'pending',
    inviteLink,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    sentAt: nowTimestamp(),
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  });

  await sendParentInviteEmail(parentEmail, request.parent.name, [request.student.name], inviteLink);
  return { created: true, inviteLink };
}

async function activateParentPortalEntitlement(invoice: BillingInvoiceDocument) {
  const parentEmail = normalizeEmail(invoice.parentEmail);
  const entitlementRef = firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.PARENT_PORTAL_ENTITLEMENTS)
    .doc(parentEmail);
  const snapshot = await entitlementRef.get();

  const existing = snapshot.exists
    ? (snapshot.data() as ParentPortalEntitlementDocument)
    : null;
  const now = new Date();
  const existingEndAt = toDate(existing?.endAt);
  const startAt =
    existingEndAt && existingEndAt.getTime() > now.getTime() ? existingEndAt : now;
  const endAt = addDays(startAt, ONE_YEAR_DAYS);
  const parent = await getParentByEmail(parentEmail);

  await entitlementRef.set(
    {
      parentEmail,
      parentId: parent?.id,
      status: 'active',
      startAt: admin.firestore.Timestamp.fromDate(startAt),
      endAt: admin.firestore.Timestamp.fromDate(endAt),
      lastInvoiceId: invoice.id,
      lastPaymentAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
      createdAt: existing?.createdAt || nowTimestamp(),
    },
    { merge: true },
  );
}

export async function createEnrollmentApprovalInvoice(
  enrollmentRequestId: string,
  origin?: string,
) {
  const request = await getEnrollmentRequest(enrollmentRequestId);
  if (!request) {
    throw new Error('Enrollment request not found');
  }

  if (request.status === 'Approved') {
    throw new Error('Enrollment request is already approved');
  }

  const settings = await getBillingSettings();
  const existingStudent = await getStudentByEmail(request.student.email);
  const entitlement = await getParentPortalEntitlementByEmail(request.parent.email);
  const portalFeeRequired = !isEntitlementActive(entitlement);
  const isNewStudent = !existingStudent;

  const lineItems: BillingLineItem[] = [];
  const lineItemContext = {
    parentEmail: normalizeEmail(request.parent.email),
    parentName: request.parent.name,
    studentEmail: normalizeEmail(request.student.email),
    studentName: request.student.name,
    className: request.className,
    subject: request.subject,
    centerName: request.centerName,
  };

  if (isNewStudent) {
    lineItems.push(buildBillingLineItem('admission_fee', settings, lineItemContext));
  }

  if (portalFeeRequired) {
    lineItems.push(buildBillingLineItem('parent_portal_yearly', settings, lineItemContext));
  }

  if (lineItems.length === 0) {
    return {
      requiresPayment: false,
      invoice: null,
      settings,
      request,
      existingStudentId: existingStudent?.id,
    };
  }

  const dueAt = addDays(new Date(), settings.invoiceDueDays);
  const invoiceToken = buildInvoiceToken();
  const invoiceNumber = buildInvoiceNumber();
  const amountTotal = getBillingInvoiceTotal(lineItems);

  const invoicePayload = {
    invoiceNumber,
    invoiceToken,
    parentEmail: normalizeEmail(request.parent.email),
    parentName: request.parent.name,
    parentPhone: request.parent.phone,
    studentEmail: normalizeEmail(request.student.email),
    studentName: request.student.name,
    enrollmentRequestId: request.id,
    classId: request.classId,
    className: request.className,
    subject: request.subject,
    centerName: request.centerName,
    currency: settings.currency,
    status: 'pending',
    lineItems,
    amountTotal,
    dueAt: admin.firestore.Timestamp.fromDate(dueAt),
    paymentUrl: buildInvoiceUrl(invoiceToken, origin),
    finalization: {
      status: 'pending',
    },
    metadata: {
      isNewStudent,
      portalFeeRequired,
      studentId: existingStudent?.id,
    },
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };

  const invoiceRef = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.INVOICES)
    .add(invoicePayload);

  await firebaseAdmin.db
    .collection('enrollmentRequests')
    .doc(request.id)
    .update({
      status: 'Awaiting Payment',
      billingStatus: 'pending',
      billingInvoiceId: invoiceRef.id,
      billingRequiredAmount: amountTotal,
      approvedPendingPaymentAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    });

  const createdInvoice: BillingInvoiceDocument = {
    id: invoiceRef.id,
    ...invoicePayload,
  } as BillingInvoiceDocument;

  const emailResult = await sendInvoiceEmail(createdInvoice);
  if (emailResult.success) {
    await invoiceRef.update({
      emailSentAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    });
  }

  return {
    requiresPayment: true,
    invoice: createdInvoice,
    settings,
    request,
    existingStudentId: existingStudent?.id,
  };
}

export async function finalizeEnrollmentWithoutPayment(
  enrollmentRequestId: string,
) {
  const request = await getEnrollmentRequest(enrollmentRequestId);
  if (!request) {
    throw new Error('Enrollment request not found');
  }

  const studentId = await createStudentFromEnrollmentRequest(request);
  await ensureStudentEnrollment(studentId, request);
  await upsertParentInviteForStudent(request, studentId);

  await firebaseAdmin.db.collection('enrollmentRequests').doc(request.id).update({
    status: 'Approved',
    billingStatus: 'not_required',
    studentId,
    processedAt: nowTimestamp(),
    finalizedAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  });

  return { studentId };
}

export async function createBillingCheckoutSession(
  invoice: BillingInvoiceDocument,
  origin?: string,
) {
  const stripe = ensureStripe();

  if (invoice.status !== 'pending') {
    throw new Error('Invoice is not payable');
  }

  if (invoice.amountTotal <= 0) {
    throw new Error('Invoice total must be greater than zero');
  }

  const siteUrl = getSiteUrl(origin);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: invoice.parentEmail,
    payment_method_types: ['card'],
    line_items: invoice.lineItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: invoice.currency.toLowerCase(),
        unit_amount: Math.round(item.amount * 100),
        product_data: {
          name: item.label,
          description: item.description,
        },
      },
    })),
    metadata: {
      invoiceId: invoice.id,
      invoiceToken: invoice.invoiceToken,
      parentEmail: invoice.parentEmail,
      studentEmail: invoice.studentEmail,
    },
    success_url: `${siteUrl}/pay/${invoice.invoiceToken}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/pay/${invoice.invoiceToken}/cancel`,
  });

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoice.id).update({
    stripeCheckoutSessionId: session.id,
    updatedAt: nowTimestamp(),
  });

  return session;
}

export async function getPublicInvoiceDetails(invoiceToken: string) {
  const invoice = await getBillingInvoiceByToken(invoiceToken);
  if (!invoice) {
    return null;
  }

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    parentName: invoice.parentName,
    studentName: invoice.studentName,
    className: invoice.className,
    subject: invoice.subject,
    currency: invoice.currency,
    status: invoice.status,
    amountTotal: invoice.amountTotal,
    dueAt: toDate(invoice.dueAt)?.toISOString() || null,
    paymentUrl: invoice.paymentUrl,
    lineItems: invoice.lineItems,
  };
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

type BillingManagementStudent = {
  studentId: string;
  studentName: string;
  studentEmail: string;
  year?: string;
  school?: string;
};

export type BillingManagementAccount = {
  parentId?: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  students: BillingManagementStudent[];
  portalStatus: 'active' | 'payment_required' | 'expired' | 'none';
  portalPaidUntil: string | null;
  totalOutstandingAmount: number;
  outstandingInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    amountTotal: number;
    currency: string;
    dueAt: string | null;
    status: string;
  }>;
  latestPayment: {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    paidAt: string | null;
    provider: 'stripe' | 'manual' | 'unknown';
  } | null;
};

export type AdmissionFeeManagementRecord = {
  studentId: string;
  studentName: string;
  studentEmail: string;
  year?: string;
  school?: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  admissionStatus: 'paid' | 'payment_required' | 'none';
  totalOutstandingAmount: number;
  outstandingInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    amountTotal: number;
    currency: string;
    dueAt: string | null;
    status: string;
  }>;
  latestPayment: {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    paidAt: string | null;
    provider: 'stripe' | 'manual' | 'unknown';
  } | null;
};

async function getStudentsByParentEmail(parentEmail: string) {
  const snapshot = await firebaseAdmin.db
    .collection('students')
    .where('parent.email', '==', parentEmail)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as StudentDocument;
    return {
      id: doc.id,
      name: data.name,
      email: data.email,
      year: data.year,
      school: data.school,
    };
  });
}

export async function getBillingManagementOverview(): Promise<{
  accounts: BillingManagementAccount[];
  admissionFees: AdmissionFeeManagementRecord[];
  summary: {
    totalParents: number;
    activeParents: number;
    lockedParents: number;
    pendingInvoices: number;
    overdueInvoices: number;
    admissionPaidStudents: number;
    admissionPendingStudents: number;
  };
}> {
  const [parentsSnapshot, studentsSnapshot, invoicesSnapshot, entitlementsSnapshot, paymentsSnapshot] =
    await Promise.all([
      firebaseAdmin.db.collection('parents').get(),
      firebaseAdmin.db.collection('students').get(),
      firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).get(),
      firebaseAdmin.db.collection(BILLING_COLLECTIONS.PARENT_PORTAL_ENTITLEMENTS).get(),
      firebaseAdmin.db.collection(BILLING_COLLECTIONS.PAYMENTS).get(),
    ]);

  const accounts = new Map<
    string,
    {
      parentId?: string;
      parentName: string;
      parentEmail: string;
      parentPhone?: string;
      students: BillingManagementStudent[];
      entitlement?: ParentPortalEntitlementDocument | null;
      invoices: BillingInvoiceDocument[];
      payments: BillingPaymentDocument[];
    }
  >();

  const ensureAccount = (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    let account = accounts.get(normalizedEmail);
    if (!account) {
      account = {
        parentName: 'Parent',
        parentEmail: normalizedEmail,
        students: [],
        invoices: [],
        payments: [],
      };
      accounts.set(normalizedEmail, account);
    }
    return account;
  };

  parentsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as FirestoreData & {
      email?: string;
      name?: string;
      displayName?: string;
      phone?: string;
      linkedStudents?: Array<{
        studentId?: string;
        id?: string;
        studentName?: string;
        name?: string;
        studentEmail?: string;
        email?: string;
      }>;
    };
    const email = String(data.email || '').trim().toLowerCase();
    if (!email) return;

    const account = ensureAccount(email);
    account.parentId = doc.id;
    account.parentName = String(data.displayName || data.name || account.parentName);
    account.parentPhone = String(data.phone || account.parentPhone || '');

    (data.linkedStudents || []).forEach((student) => {
      const studentId = String(student.studentId || student.id || '').trim();
      const studentName = String(student.studentName || student.name || '').trim();
      const studentEmail = String(student.studentEmail || student.email || '').trim().toLowerCase();
      if (!studentId && !studentName && !studentEmail) return;
      if (account!.students.some((item) => item.studentId === studentId || item.studentEmail === studentEmail)) {
        return;
      }
      account!.students.push({
        studentId: studentId || studentEmail,
        studentName: studentName || 'Student',
        studentEmail,
      });
    });
  });

  studentsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as StudentDocument;
    const parentEmail = normalizeEmail(data.parent?.email || '');
    if (!parentEmail) return;

    const account = ensureAccount(parentEmail);
    account.parentName = data.parent?.name || account.parentName;
    account.parentPhone = data.parent?.phone || account.parentPhone;

    if (!account.students.some((student) => student.studentId === doc.id || student.studentEmail === data.email)) {
      account.students.push({
        studentId: doc.id,
        studentName: data.name,
        studentEmail: normalizeEmail(data.email),
        year: data.year,
        school: data.school,
      });
    }
  });

  invoicesSnapshot.docs.forEach((doc) => {
    const data = doc.data() as Omit<BillingInvoiceDocument, 'id'>;
    const email = normalizeEmail(String(data.parentEmail || ''));
    if (!email) return;
    const account = ensureAccount(email);
    account.invoices.push({
      id: doc.id,
      ...data,
    } as BillingInvoiceDocument);
    account.parentName = data.parentName || account.parentName;
    account.parentPhone = data.parentPhone || account.parentPhone;
  });

  entitlementsSnapshot.docs.forEach((doc) => {
    const email = normalizeEmail(doc.id);
    if (!email) return;
    const account = ensureAccount(email);
    account.entitlement = doc.data() as ParentPortalEntitlementDocument;
  });

  paymentsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as Omit<BillingPaymentDocument, 'id'>;
    const email = normalizeEmail(String(data.parentEmail || ''));
    if (!email) return;
    const account = ensureAccount(email);
    account.payments.push({
      id: doc.id,
      ...data,
    } as BillingPaymentDocument);
  });

  const now = new Date();
  const accountList = [...accounts.values()]
    .map((account): BillingManagementAccount => {
      const entitlementActive = isEntitlementActive(account.entitlement || null);
      const entitlementEndAt = toDate(account.entitlement?.endAt)?.toISOString() || null;
      const parentPortalInvoices = account.invoices.filter((invoice) =>
        hasBillingFee(invoice.lineItems, 'parent_portal_yearly'),
      );
      const outstandingInvoices = parentPortalInvoices
        .filter((invoice) => invoice.status === 'pending')
        .sort((a, b) => {
          const aTime = toDate(a.createdAt)?.getTime() || 0;
          const bTime = toDate(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        })
        .map((invoice) => ({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountTotal: invoice.amountTotal,
          currency: invoice.currency,
          dueAt: toDate(invoice.dueAt)?.toISOString() || null,
          status: invoice.status,
        }));

      const latestPaidInvoice = parentPortalInvoices
        .filter((invoice) => invoice.status === 'paid')
        .sort((a, b) => {
          const aTime = toDate(a.paidAt || a.updatedAt)?.getTime() || 0;
          const bTime = toDate(b.paidAt || b.updatedAt)?.getTime() || 0;
          return bTime - aTime;
        })[0];

      const latestPayment = account.payments
        .sort((a, b) => {
          const aTime = toDate(a.processedAt)?.getTime() || 0;
          const bTime = toDate(b.processedAt)?.getTime() || 0;
          return bTime - aTime;
        })[0];

      const portalStatus: BillingManagementAccount['portalStatus'] = entitlementActive
        ? 'active'
        : outstandingInvoices.length > 0
          ? 'payment_required'
          : account.entitlement
            ? 'expired'
            : 'none';

      return {
        parentId: account.parentId,
        parentName: account.parentName,
        parentEmail: account.parentEmail,
        parentPhone: account.parentPhone,
        students: account.students.sort((a, b) => a.studentName.localeCompare(b.studentName)),
        portalStatus,
        portalPaidUntil: entitlementEndAt,
        totalOutstandingAmount: outstandingInvoices.reduce((sum, invoice) => sum + invoice.amountTotal, 0),
        outstandingInvoices,
        latestPayment: latestPaidInvoice || latestPayment
          ? {
              invoiceId: latestPaidInvoice?.id || latestPayment?.invoiceId || '',
              invoiceNumber: latestPaidInvoice?.invoiceNumber || latestPayment?.invoiceNumber || '',
              amount: latestPaidInvoice?.amountTotal || latestPayment?.amount || 0,
              paidAt:
                toDate(latestPaidInvoice?.paidAt || latestPayment?.processedAt)?.toISOString() || null,
              provider:
                latestPayment?.provider ||
                (latestPaidInvoice?.stripePaymentIntentId ? 'stripe' : 'unknown'),
            }
          : null,
      };
    })
    .sort((a, b) => a.parentName.localeCompare(b.parentName));

  const pendingInvoices = accountList.reduce((sum, account) => sum + account.outstandingInvoices.length, 0);
  const overdueInvoices = accountList.reduce(
    (sum, account) =>
      sum +
      account.outstandingInvoices.filter((invoice) => {
        const dueAt = invoice.dueAt ? new Date(invoice.dueAt) : null;
        return Boolean(dueAt && dueAt.getTime() < now.getTime());
      }).length,
    0,
  );

  const admissionFeeRecords = studentsSnapshot.docs
    .map((doc): AdmissionFeeManagementRecord => {
      const student = doc.data() as StudentDocument;
      const studentEmail = normalizeEmail(student.email);
      const admissionInvoices = invoicesSnapshot.docs
        .map((invoiceDoc) => ({
          id: invoiceDoc.id,
          ...(invoiceDoc.data() as Omit<BillingInvoiceDocument, 'id'>),
        }))
        .filter(
          (invoice) =>
            invoice.studentEmail === studentEmail &&
            hasBillingFee(invoice.lineItems, 'admission_fee'),
        );

      const outstandingInvoices = admissionInvoices
        .filter((invoice) => invoice.status === 'pending')
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
        .map((invoice) => ({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountTotal: invoice.amountTotal,
          currency: invoice.currency,
          dueAt: toDate(invoice.dueAt)?.toISOString() || null,
          status: invoice.status,
        }));

      const latestPaidInvoice = admissionInvoices
        .filter((invoice) => invoice.status === 'paid')
        .sort((a, b) => (toDate(b.paidAt || b.updatedAt)?.getTime() || 0) - (toDate(a.paidAt || a.updatedAt)?.getTime() || 0))[0];

      const matchingPayment = paymentsSnapshot.docs
        .map((paymentDoc) => ({
          id: paymentDoc.id,
          ...(paymentDoc.data() as Omit<BillingPaymentDocument, 'id'>),
        }))
        .find((payment) => payment.invoiceId === latestPaidInvoice?.id);

      const admissionStatus: AdmissionFeeManagementRecord['admissionStatus'] = latestPaidInvoice
        ? 'paid'
        : outstandingInvoices.length > 0
          ? 'payment_required'
          : 'none';

      return {
        studentId: doc.id,
        studentName: student.name,
        studentEmail,
        year: student.year,
        school: student.school,
        parentName: student.parent.name,
        parentEmail: normalizeEmail(student.parent.email),
        parentPhone: student.parent.phone,
        admissionStatus,
        totalOutstandingAmount: outstandingInvoices.reduce((sum, invoice) => sum + invoice.amountTotal, 0),
        outstandingInvoices,
        latestPayment: latestPaidInvoice
          ? {
              invoiceId: latestPaidInvoice.id,
              invoiceNumber: latestPaidInvoice.invoiceNumber,
              amount: latestPaidInvoice.amountTotal,
              paidAt: toDate(latestPaidInvoice.paidAt)?.toISOString() || null,
              provider:
                matchingPayment?.provider ||
                (latestPaidInvoice.stripePaymentIntentId ? 'stripe' : 'unknown'),
            }
          : null,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  return {
    accounts: accountList,
    admissionFees: admissionFeeRecords,
    summary: {
      totalParents: accountList.length,
      activeParents: accountList.filter((account) => account.portalStatus === 'active').length,
      lockedParents: accountList.filter((account) => account.portalStatus !== 'active').length,
      pendingInvoices,
      overdueInvoices,
      admissionPaidStudents: admissionFeeRecords.filter((student) => student.admissionStatus === 'paid').length,
      admissionPendingStudents: admissionFeeRecords.filter((student) => student.admissionStatus === 'payment_required').length,
    },
  };
}

async function createBillingInvoiceRequest(params: {
  feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
  parentEmail: string;
  parentName?: string;
  parentPhone?: string;
  studentId?: string;
  origin?: string;
  sendEmail?: boolean;
}) {
  const normalizedParentEmail = normalizeEmail(params.parentEmail);
  const settings = await getBillingSettings();
  const parent = await getParentByEmail(normalizedParentEmail);
  const student = params.studentId ? await getStudentById(params.studentId) : null;

  if (params.feeCodes.includes('admission_fee') && !student) {
    throw new Error('Student is required for admission fee invoices');
  }

  const parentName = params.parentName || String(parent?.displayName || parent?.name || student?.parent.name || 'Parent');
  const parentPhone = params.parentPhone || String(parent?.phone || student?.parent.phone || '');
  const lineItemContext = {
    parentEmail: normalizedParentEmail,
    parentName,
    parentPhone,
    studentEmail: student?.email ? normalizeEmail(student.email) : '',
    studentName: student?.name || '',
    className: 'Existing student access',
    subject: 'Billing',
    centerName: 'DRU EDU',
  };

  const lineItems = params.feeCodes.map((feeCode) => buildBillingLineItem(feeCode, settings, lineItemContext));
  const amountTotal = getBillingInvoiceTotal(lineItems);
  const dueAt = addDays(new Date(), settings.invoiceDueDays);
  const invoiceToken = buildInvoiceToken();
  const invoiceNumber = buildInvoiceNumber();

  const invoicePayload = {
    invoiceNumber,
    invoiceToken,
    parentEmail: normalizedParentEmail,
    parentName,
    parentPhone: parentPhone || undefined,
    studentEmail: lineItemContext.studentEmail || '',
    studentName: lineItemContext.studentName || 'Current student',
    enrollmentRequestId: '',
    classId: '',
    className: lineItemContext.className || '',
    subject: lineItemContext.subject || '',
    centerName: lineItemContext.centerName || 'DRU EDU',
    currency: settings.currency,
    status: 'pending',
    lineItems,
    amountTotal,
    dueAt: admin.firestore.Timestamp.fromDate(dueAt),
    paymentUrl: buildInvoiceUrl(invoiceToken, params.origin),
    finalization: {
      status: 'pending',
    },
    metadata: {
      isNewStudent: false,
      portalFeeRequired: params.feeCodes.includes('parent_portal_yearly'),
      studentId: student?.id,
    },
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };

  const invoiceRef = await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).add(invoicePayload);
  const invoice = { id: invoiceRef.id, ...invoicePayload } as BillingInvoiceDocument;
  if (params.sendEmail !== false) {
    await sendInvoiceEmailAndStamp(invoice);
  }

  return invoice;
}

export async function sendBillingPaymentLink(params: {
  feeCode: 'admission_fee' | 'parent_portal_yearly';
  parentEmail: string;
  studentId?: string;
  origin?: string;
}) {
  const feeDefinition = getBillingFeeDefinition(params.feeCode);
  const normalizedParentEmail = normalizeEmail(params.parentEmail);
  const student = params.studentId ? await getStudentById(params.studentId) : null;
  const existingPendingInvoices = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.INVOICES)
    .where('parentEmail', '==', normalizedParentEmail)
    .where('status', '==', 'pending')
    .get();

  const existingInvoiceDoc = existingPendingInvoices.docs.find((doc) => {
    const invoice = doc.data() as BillingInvoiceDocument;
    const sameFee = hasBillingFee(invoice.lineItems, params.feeCode);
    const singleFee = invoice.lineItems.length === 1;
    const sameStudent =
      params.feeCode === 'parent_portal_yearly' ||
      invoice.metadata?.studentId === params.studentId ||
      invoice.studentEmail === normalizeEmail(student?.email || '');
    return sameFee && singleFee && sameStudent;
  });

  if (existingInvoiceDoc) {
    const invoice = {
      id: existingInvoiceDoc.id,
      ...(existingInvoiceDoc.data() as Omit<BillingInvoiceDocument, 'id'>),
    } as BillingInvoiceDocument;

    await sendInvoiceEmailAndStamp(invoice);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentUrl: invoice.paymentUrl,
      feeLabel: feeDefinition.label,
      reused: true,
    };
  }

  const invoice = await createBillingInvoiceRequest({
    feeCodes: [params.feeCode],
    parentEmail: normalizedParentEmail,
    studentId: params.studentId,
    origin: params.origin,
  });

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    paymentUrl: invoice.paymentUrl,
    feeLabel: feeDefinition.label,
    reused: false,
  };
}

export async function markFeePaidOffline(params: {
  feeCode: 'admission_fee' | 'parent_portal_yearly';
  parentEmail: string;
  studentId?: string;
  notes?: string;
  processedBy?: string;
}) {
  if (params.feeCode === 'parent_portal_yearly') {
    return markParentPortalPaidOffline(params.parentEmail, {
      notes: params.notes,
      processedBy: params.processedBy,
    });
  }

  const normalizedParentEmail = normalizeEmail(params.parentEmail);
  if (!params.studentId) {
    throw new Error('Student is required to mark admission fee paid');
  }

  const settings = await getBillingSettings();
  const student = await getStudentById(params.studentId);
  if (!student) {
    throw new Error('Student not found');
  }

  const pendingInvoicesSnapshot = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.INVOICES)
    .where('parentEmail', '==', normalizedParentEmail)
    .where('status', '==', 'pending')
    .get();

  const matchingPendingInvoice = pendingInvoicesSnapshot.docs.find((doc) => {
    const data = doc.data() as BillingInvoiceDocument;
    return (
      hasBillingFee(data.lineItems, 'admission_fee') &&
      data.lineItems.length === 1 &&
      (data.metadata?.studentId === params.studentId || data.studentEmail === normalizeEmail(student.email))
    );
  });

  const paidAt = nowTimestamp();
  let invoiceId = '';
  let invoiceNumber = '';
  let amountTotal = settings.admissionFeeAmount;

  if (matchingPendingInvoice) {
    const data = matchingPendingInvoice.data() as BillingInvoiceDocument;
    invoiceId = matchingPendingInvoice.id;
    invoiceNumber = data.invoiceNumber;
    amountTotal = data.amountTotal;

    await matchingPendingInvoice.ref.set(
      {
        status: 'paid',
        billingStatus: 'paid',
        paidAt,
        updatedAt: paidAt,
        finalization: {
          status: 'completed',
          completedAt: paidAt,
        },
      },
      { merge: true },
    );
  } else {
    const invoice = await createBillingInvoiceRequest({
      feeCodes: ['admission_fee'],
      parentEmail: normalizedParentEmail,
      studentId: params.studentId,
      sendEmail: false,
    });

    invoiceId = invoice.id;
    invoiceNumber = invoice.invoiceNumber;
    amountTotal = invoice.amountTotal;

    await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoiceId).set(
      {
        status: 'paid',
        billingStatus: 'paid',
        paidAt,
        updatedAt: paidAt,
        finalization: {
          status: 'completed',
          completedAt: paidAt,
        },
      },
      { merge: true },
    );
  }

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.PAYMENTS).add({
    invoiceId,
    invoiceNumber,
    provider: 'manual',
    status: 'succeeded',
    amount: amountTotal,
    currency: settings.currency,
    parentEmail: normalizedParentEmail,
    notes: params.notes || 'Admission fee marked paid offline by admin',
    processedBy: params.processedBy || 'admin',
    processedAt: paidAt,
    createdAt: paidAt,
  });

  return {
    parentEmail: normalizedParentEmail,
    studentId: params.studentId,
    invoiceId,
    invoiceNumber,
  };
}

export async function markParentPortalPaidOffline(
  parentEmail: string,
  options?: {
    notes?: string;
    processedBy?: string;
  },
) {
  const normalizedEmail = normalizeEmail(parentEmail);
  if (!normalizedEmail) {
    throw new Error('Parent email is required');
  }

  const settings = await getBillingSettings();
  if (settings.parentPortalYearlyFeeAmount <= 0) {
    throw new Error('Parent portal yearly fee amount is not configured');
  }

  const [parent, students, existingEntitlement, pendingInvoicesSnapshot] = await Promise.all([
    getParentByEmail(normalizedEmail),
    getStudentsByParentEmail(normalizedEmail),
    getParentPortalEntitlementByEmail(normalizedEmail),
    firebaseAdmin.db
      .collection(BILLING_COLLECTIONS.INVOICES)
      .where('parentEmail', '==', normalizedEmail)
      .where('status', '==', 'pending')
      .get(),
  ]);

  const primaryStudent = students[0];
  const parentName =
    String(parent?.displayName || parent?.name || primaryStudent?.name || 'Parent');
  const parentPhone =
    String(parent?.phone || '') || undefined;

  let invoiceId = '';
  let invoiceNumber = '';
  let amountTotal = settings.parentPortalYearlyFeeAmount;
  const paidAt = nowTimestamp();

  const parentPortalInvoice = pendingInvoicesSnapshot.docs.find((doc) => {
    const data = doc.data() as BillingInvoiceDocument;
    return Array.isArray(data.lineItems) && hasBillingFee(data.lineItems, 'parent_portal_yearly');
  });

  if (parentPortalInvoice) {
    const data = parentPortalInvoice.data() as BillingInvoiceDocument;
    invoiceId = parentPortalInvoice.id;
    invoiceNumber = data.invoiceNumber;
    amountTotal = data.amountTotal;

    await parentPortalInvoice.ref.set(
      {
        status: 'paid',
        billingStatus: 'paid',
        paidAt,
        updatedAt: paidAt,
        finalization: {
          status: 'completed',
          completedAt: paidAt,
        },
      },
      { merge: true },
    );
  } else {
    invoiceNumber = buildInvoiceNumber();
    const invoiceToken = buildInvoiceToken();
    const createdAt = nowTimestamp();
    const dueAt = admin.firestore.Timestamp.fromDate(new Date());

    const invoiceRef = await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).add({
      invoiceNumber,
      invoiceToken,
      parentEmail: normalizedEmail,
      parentName,
      parentPhone,
      studentEmail: primaryStudent?.email || '',
      studentName: primaryStudent?.name || 'Existing student',
      enrollmentRequestId: '',
      classId: '',
      className: 'Existing student access',
      subject: 'Parent Portal',
      centerName: 'DRU EDU',
      currency: settings.currency,
      status: 'paid',
      lineItems: [
        buildBillingLineItem(
          'parent_portal_yearly',
          settings,
          {
            parentEmail: normalizedEmail,
            parentName,
            studentEmail: primaryStudent?.email || '',
            studentName: primaryStudent?.name || 'Existing student',
          },
          {
            description: 'Manual admin payment for yearly DRU EDU parent portal access',
          },
        ),
      ],
      amountTotal,
      dueAt,
      paidAt,
      checkoutCompletedAt: paidAt,
      finalization: {
        status: 'completed',
        completedAt: paidAt,
      },
      metadata: {
        isNewStudent: false,
        portalFeeRequired: true,
      },
      createdAt,
      updatedAt: createdAt,
    });

    invoiceId = invoiceRef.id;
  }

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.PAYMENTS).add({
    invoiceId,
    invoiceNumber,
    provider: 'manual',
    status: 'succeeded',
    amount: amountTotal,
    currency: settings.currency,
    parentEmail: normalizedEmail,
    notes: options?.notes || 'Marked paid offline by admin',
    processedBy: options?.processedBy || 'admin',
    processedAt: paidAt,
    createdAt: paidAt,
  });

  await activateParentPortalEntitlement({
    id: invoiceId,
    invoiceNumber,
    invoiceToken: '',
    parentEmail: normalizedEmail,
    parentName,
    parentPhone,
    studentEmail: primaryStudent?.email || '',
    studentName: primaryStudent?.name || 'Existing student',
    enrollmentRequestId: '',
    classId: '',
    className: 'Existing student access',
    subject: 'Parent Portal',
    centerName: 'DRU EDU',
    currency: settings.currency,
    status: 'paid',
    lineItems: [
      buildBillingLineItem(
        'parent_portal_yearly',
        settings,
        {
          parentEmail: normalizedEmail,
          parentName,
          studentEmail: primaryStudent?.email || '',
          studentName: primaryStudent?.name || 'Existing student',
        },
        {
          description: 'Manual admin payment for yearly DRU EDU parent portal access',
        },
      ),
    ],
    amountTotal,
    dueAt: new Date().toISOString(),
    paidAt,
    finalization: {
      status: 'completed',
      completedAt: paidAt,
    },
    metadata: {
      isNewStudent: false,
      portalFeeRequired: true,
    },
    createdAt: paidAt,
    updatedAt: paidAt,
  } as BillingInvoiceDocument);

  return {
    parentEmail: normalizedEmail,
    invoiceId,
    invoiceNumber,
    existingEntitlementStatus: existingEntitlement?.status || 'none',
  };
}

export async function processStripeBillingEvent(
  eventId: string,
  eventType: string,
  payload: Stripe.Event.Data.Object,
) {
  const eventRef = firebaseAdmin.db.collection(BILLING_COLLECTIONS.EVENTS).doc(eventId);
  const eventSnapshot = await eventRef.get();
  if (eventSnapshot.exists) {
    return { alreadyProcessed: true };
  }

  await eventRef.set({
    eventType,
    processedAt: nowTimestamp(),
    createdAt: nowTimestamp(),
  });

  if (eventType !== 'checkout.session.completed') {
    return { alreadyProcessed: false, ignored: true };
  }

  const session = payload as Stripe.Checkout.Session;
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) {
    throw new Error('Missing invoiceId in Stripe session metadata');
  }

  const invoice = await getBillingInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error(`Billing invoice not found for ${invoiceId}`);
  }

  if (invoice.finalization?.status === 'completed' && invoice.status === 'paid') {
    return { alreadyProcessed: false, invoiceId, alreadyFinalized: true };
  }

  const invoiceRef = firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoiceId);
  await invoiceRef.set(
    {
      status: 'paid',
      billingStatus: 'paid',
      paidAt: nowTimestamp(),
      checkoutCompletedAt: nowTimestamp(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : undefined,
      updatedAt: nowTimestamp(),
    },
    { merge: true },
  );

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.PAYMENTS).add({
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    provider: 'stripe',
    status: 'succeeded',
    amount: invoice.amountTotal,
    currency: invoice.currency,
    parentEmail: invoice.parentEmail,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : undefined,
    processedAt: nowTimestamp(),
    createdAt: nowTimestamp(),
  });

  try {
    if (hasBillingFee(invoice.lineItems, 'parent_portal_yearly')) {
      await activateParentPortalEntitlement(invoice);
    }

    const request = await getEnrollmentRequest(invoice.enrollmentRequestId);
    if (!request) {
      throw new Error('Related enrollment request not found');
    }

    const studentId =
      invoice.metadata.studentId || (await createStudentFromEnrollmentRequest(request));
    await ensureStudentEnrollment(studentId, request);
    await upsertParentInviteForStudent(request, studentId);

    await firebaseAdmin.db.collection('enrollmentRequests').doc(request.id).update({
      status: 'Approved',
      billingStatus: 'paid',
      billingInvoiceId: invoice.id,
      studentId,
      processedAt: nowTimestamp(),
      finalizedAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    });

    await invoiceRef.set(
      {
        finalization: {
          status: 'completed',
          completedAt: nowTimestamp(),
        },
      },
      { merge: true },
    );
  } catch (error: any) {
    await invoiceRef.set(
      {
        finalization: {
          status: 'failed',
          error: error?.message || 'Unknown finalization error',
        },
        updatedAt: nowTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }

  return { alreadyProcessed: false, invoiceId };
}

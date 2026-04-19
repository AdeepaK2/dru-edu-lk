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
  BillingSettings,
  BillingSettingsDocument,
  DEFAULT_BILLING_SETTINGS,
  ParentPortalEntitlementDocument,
} from '@/models/billingSchema';
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
      <p>Your enrollment request for <strong>${invoice.studentName}</strong> requires payment before mobile access and parent portal onboarding can be completed.</p>
      <p><strong>Invoice:</strong> ${invoice.invoiceNumber}</p>
      <p><strong>Due date:</strong> ${dueAt ? dueAt.toLocaleDateString('en-AU') : 'As soon as possible'}</p>
      <ul>${lineItemsHtml}</ul>
      <p><strong>Total:</strong> ${formatCurrency(invoice.amountTotal)}</p>
      <div style="margin: 28px 0;">
        <a href="${invoice.paymentUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">
          Pay Parent Portal Fee
        </a>
      </div>
      <p>After payment is confirmed, we will finish enrollment and send your parent portal invite if needed.</p>
      ${supportLine}
    </div>
  `;

  return sendGenericEmail(
    invoice.parentEmail,
    `DRU EDU invoice ${invoice.invoiceNumber}`,
    html,
  );
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

  if (isNewStudent) {
    if (settings.admissionFeeAmount <= 0) {
      throw new Error('Admission fee amount is not configured');
    }

    lineItems.push({
      type: 'admission_fee',
      label: 'Admission Fee',
      description: `New student admission for ${request.student.name}`,
      amount: settings.admissionFeeAmount,
      quantity: 1,
      studentEmail: normalizeEmail(request.student.email),
      studentName: request.student.name,
    });
  }

  if (portalFeeRequired) {
    if (settings.parentPortalYearlyFeeAmount <= 0) {
      throw new Error('Parent portal yearly fee amount is not configured');
    }

    lineItems.push({
      type: 'parent_portal_yearly',
      label: 'Parent Portal Fee',
      description: 'Yearly DRU EDU parent portal access',
      amount: settings.parentPortalYearlyFeeAmount,
      quantity: 1,
      studentEmail: normalizeEmail(request.student.email),
      studentName: request.student.name,
    });
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
  const amountTotal = lineItems.reduce((total, item) => total + item.amount * item.quantity, 0);

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
    if (invoice.lineItems.some((item) => item.type === 'parent_portal_yearly')) {
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

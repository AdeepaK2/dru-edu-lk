import 'server-only';

import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { randomBytes } from 'crypto';
import { firebaseAdmin } from '@/utils/firebase-server';
import { sendGenericEmail, sendStudentWelcomeEmail } from '@/utils/emailService';
import { generateRandomPassword } from '@/utils/passwordUtils';
import { generateAvatarInitials } from '@/utils/avatarUtils';
import {
  BILLING_COLLECTIONS,
  BillingDiscountDocument,
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

function isFirestoreAlreadyExistsError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  if (code === 6 || code === '6' || code === 'already-exists' || code === 'ALREADY_EXISTS') {
    return true;
  }

  const message = String((error as { message?: unknown }).message || '');
  return /already exists/i.test(message);
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
  };

  if (updatedBy) {
    payload.updatedBy = updatedBy;
  }

  if (!settings.supportEmail) {
    delete payload.supportEmail;
  }

  if (!settings.supportPhone) {
    delete payload.supportPhone;
  }

  await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.SETTINGS)
    .doc('global')
    .set(payload, { merge: true });

  return payload;
}

type BillingDiscountInput = {
  name: string;
  scope: 'parent' | 'student' | 'additional_student' | 'coupon_code';
  type: 'percentage' | 'fixed';
  value: number;
  parentEmail?: string;
  parentName?: string;
  studentId?: string;
  studentName?: string;
  couponCode?: string;
  feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
  reason?: string;
  isActive?: boolean;
  createdBy?: string;
};

function normalizeFeeCodes(
  feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>,
): Array<'admission_fee' | 'parent_portal_yearly'> {
  return Array.from(new Set(feeCodes)).sort() as Array<'admission_fee' | 'parent_portal_yearly'>;
}

function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}

function withoutUndefined<T extends FirestoreData>(data: T) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}

export async function getBillingDiscounts(): Promise<BillingDiscountDocument[]> {
  const snapshot = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.DISCOUNTS)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<BillingDiscountDocument, 'id'>),
  }));
}

async function getApplicableBillingDiscounts(params: {
  parentEmail: string;
  studentId?: string;
  studentEmail?: string;
  feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
  discountIds?: string[];
  couponCode?: string;
}) {
  const normalizedParentEmail = normalizeEmail(params.parentEmail);
  const selectedDiscountIds = new Set((params.discountIds || []).filter(Boolean));
  const normalizedCouponCode = normalizeCouponCode(params.couponCode || '');
  const discounts = await getBillingDiscounts();
  const needsAdditionalStudentCheck = discounts.some(
    (discount) =>
      discount.isActive &&
      discount.scope === 'additional_student' &&
      discount.feeCodes.some((feeCode) => params.feeCodes.includes(feeCode)),
  );
  const additionalStudentEligible = needsAdditionalStudentCheck
    ? await isAdditionalStudentDiscountEligible({
        parentEmail: normalizedParentEmail,
        studentId: params.studentId,
        studentEmail: params.studentEmail,
      })
    : false;

  return discounts.filter((discount) => {
    if (!discount.isActive) return false;
    if (!discount.feeCodes.some((feeCode) => params.feeCodes.includes(feeCode))) return false;

    const isSelectedById = selectedDiscountIds.has(discount.id);
    const isSelectedByCode =
      normalizedCouponCode &&
      discount.scope === 'coupon_code' &&
      normalizeCouponCode(discount.couponCode || '') === normalizedCouponCode;

    if (discount.scope === 'coupon_code') {
      return Boolean(isSelectedById || isSelectedByCode);
    }

    if (discount.scope === 'additional_student') {
      return additionalStudentEligible || isSelectedById;
    }

    if (discount.scope === 'parent') {
      return normalizeEmail(discount.parentEmail || '') === normalizedParentEmail || isSelectedById;
    }

    if (discount.studentId !== params.studentId) return false;
    return normalizeEmail(discount.parentEmail || '') === normalizedParentEmail || isSelectedById;
  });
}

async function isAdditionalStudentDiscountEligible(params: {
  parentEmail: string;
  studentId?: string;
  studentEmail?: string;
}) {
  const normalizedParentEmail = normalizeEmail(params.parentEmail);
  if (!normalizedParentEmail) return false;

  const [studentsSnapshot, requestsSnapshot] = await Promise.all([
    firebaseAdmin.db
      .collection('students')
      .where('parent.email', '==', normalizedParentEmail)
      .get(),
    firebaseAdmin.db
      .collection('enrollmentRequests')
      .where('parent.email', '==', normalizedParentEmail)
      .get(),
  ]);

  const familyStudents = new Set<string>();

  studentsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as { email?: string };
    familyStudents.add(normalizeEmail(data.email || doc.id));
  });

  requestsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as {
      status?: string;
      student?: {
        email?: string;
      };
    };
    if (data.status === 'Rejected' || data.status === 'Cancelled') return;
    const studentEmail = normalizeEmail(data.student?.email || doc.id);
    familyStudents.add(studentEmail);
  });

  if (params.studentEmail) {
    familyStudents.add(normalizeEmail(params.studentEmail));
  } else if (params.studentId) {
    familyStudents.add(params.studentId);
  }

  return familyStudents.size > 1;
}

function applyDiscountsToLineItems(
  lineItems: BillingLineItem[],
  discounts: BillingDiscountDocument[],
) {
  return lineItems.map((lineItem) => {
    const applicableDiscounts = discounts.filter((discount) => discount.feeCodes.includes(lineItem.type));
    if (applicableDiscounts.length === 0) {
      return lineItem;
    }

    const originalAmount = Number(lineItem.amount || 0);
    let discountAmount = 0;

    for (const discount of applicableDiscounts) {
      if (discount.type === 'percentage') {
        discountAmount += (originalAmount * Number(discount.value || 0)) / 100;
      } else {
        discountAmount += Number(discount.value || 0);
      }
    }

    discountAmount = Math.min(originalAmount, Math.max(0, Number(discountAmount.toFixed(2))));
    const finalAmount = Math.max(0, Number((originalAmount - discountAmount).toFixed(2)));

    return {
      ...lineItem,
      amount: finalAmount,
      originalAmount,
      discountAmount,
      appliedDiscountIds: applicableDiscounts.map((discount) => discount.id),
      description:
        discountAmount > 0
          ? `${lineItem.description} (discount applied: ${formatCurrency(discountAmount)})`
          : lineItem.description,
    };
  });
}

function applyAdditionalDiscountsToLineItems(
  lineItems: BillingLineItem[],
  discounts: BillingDiscountDocument[],
) {
  return lineItems.map((lineItem) => {
    const applicableDiscounts = discounts.filter(
      (discount) =>
        discount.feeCodes.includes(lineItem.type) &&
        !lineItem.appliedDiscountIds?.includes(discount.id),
    );
    if (applicableDiscounts.length === 0) {
      return lineItem;
    }

    const currentAmount = Number(lineItem.amount || 0);
    let additionalDiscountAmount = 0;

    for (const discount of applicableDiscounts) {
      if (discount.type === 'percentage') {
        additionalDiscountAmount += (currentAmount * Number(discount.value || 0)) / 100;
      } else {
        additionalDiscountAmount += Number(discount.value || 0);
      }
    }

    additionalDiscountAmount = Math.min(
      currentAmount,
      Math.max(0, Number(additionalDiscountAmount.toFixed(2))),
    );
    const finalAmount = Math.max(0, Number((currentAmount - additionalDiscountAmount).toFixed(2)));
    const totalDiscountAmount = Number(
      (Number(lineItem.discountAmount || 0) + additionalDiscountAmount).toFixed(2),
    );

    return {
      ...lineItem,
      amount: finalAmount,
      originalAmount: lineItem.originalAmount ?? lineItem.amount,
      discountAmount: totalDiscountAmount,
      appliedDiscountIds: Array.from(
        new Set([...(lineItem.appliedDiscountIds || []), ...applicableDiscounts.map((discount) => discount.id)]),
      ),
      description:
        additionalDiscountAmount > 0
          ? `${lineItem.description} (extra discount applied: ${formatCurrency(additionalDiscountAmount)})`
          : lineItem.description,
    };
  });
}

export async function createBillingDiscount(input: BillingDiscountInput) {
  const parentEmail = normalizeEmail(input.parentEmail || '');
  if (input.scope !== 'additional_student' && input.scope !== 'coupon_code' && !parentEmail) {
    throw new Error('Parent email is required for discounts');
  }

  if (input.scope === 'student' && !input.studentId) {
    throw new Error('Student is required for student-specific discounts');
  }

  const feeCodes =
    input.scope === 'additional_student' ? ['admission_fee'] : normalizeFeeCodes(input.feeCodes);
  if (feeCodes.length === 0) {
    throw new Error('At least one billing fee must be selected');
  }

  const couponCode = input.scope === 'coupon_code' ? normalizeCouponCode(input.couponCode || '') : '';
  if (input.scope === 'coupon_code' && !couponCode) {
    throw new Error('Coupon code is required');
  }

  if (!input.name.trim()) {
    throw new Error('Discount name is required');
  }

  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new Error('Discount value must be greater than zero');
  }

  if (input.value > 100) {
    throw new Error('Percentage discounts cannot exceed 100');
  }

  const payload = withoutUndefined({
    name: input.name.trim(),
    scope: input.scope,
    type: 'percentage' as const,
    value: Number(input.value),
    couponCode: couponCode || undefined,
    parentEmail: input.scope === 'additional_student' || input.scope === 'coupon_code' ? '' : parentEmail,
    parentName: input.parentName?.trim() || undefined,
    studentId: input.studentId || undefined,
    studentName: input.studentName?.trim() || undefined,
    feeCodes,
    reason: input.reason?.trim() || undefined,
    isActive: input.isActive !== false,
    createdBy: input.createdBy || undefined,
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  });

  if (input.scope === 'additional_student') {
    const existingSnapshot = await firebaseAdmin.db
      .collection(BILLING_COLLECTIONS.DISCOUNTS)
      .where('scope', '==', 'additional_student')
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data() as Partial<BillingDiscountDocument>;
      const updatePayload = {
        ...payload,
        createdAt: existingData.createdAt || payload.createdAt,
        updatedAt: nowTimestamp(),
      };

      await existingDoc.ref.set(updatePayload, { merge: true });

      return {
        id: existingDoc.id,
        ...updatePayload,
      } as BillingDiscountDocument;
    }
  }

  if (input.scope === 'coupon_code') {
    const existingSnapshot = await firebaseAdmin.db
      .collection(BILLING_COLLECTIONS.DISCOUNTS)
      .where('scope', '==', 'coupon_code')
      .where('couponCode', '==', couponCode)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data() as Partial<BillingDiscountDocument>;
      const updatePayload = {
        ...payload,
        createdAt: existingData.createdAt || payload.createdAt,
        updatedAt: nowTimestamp(),
      };

      await existingDoc.ref.set(updatePayload, { merge: true });

      return {
        id: existingDoc.id,
        ...updatePayload,
      } as BillingDiscountDocument;
    }
  }

  const created = await firebaseAdmin.db.collection(BILLING_COLLECTIONS.DISCOUNTS).add(payload);

  return {
    id: created.id,
    ...payload,
  } as BillingDiscountDocument;
}

export async function updateBillingDiscountStatus(discountId: string, isActive: boolean) {
  if (!discountId) {
    throw new Error('Discount id is required');
  }

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.DISCOUNTS).doc(discountId).set(
    {
      isActive,
      updatedAt: nowTimestamp(),
    },
    { merge: true },
  );

  return { id: discountId, isActive };
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

function isAdmissionInvoiceForStudent(
  invoice: BillingInvoiceDocument,
  studentId: string,
  studentEmail: string,
) {
  const normalizedStudentEmail = normalizeEmail(studentEmail);
  return (
    hasBillingFee(invoice.lineItems, 'admission_fee') &&
    (invoice.metadata?.studentId === studentId ||
      (!!normalizedStudentEmail && invoice.studentEmail === normalizedStudentEmail) ||
      invoice.lineItems.some(
        (item) =>
          item.type === 'admission_fee' &&
          (item.studentId === studentId ||
            (!!normalizedStudentEmail && normalizeEmail(item.studentEmail || '') === normalizedStudentEmail)),
      ))
  );
}

async function getPaidAdmissionInvoiceForStudent(params: {
  parentEmail: string;
  studentId: string;
  studentEmail: string;
}): Promise<BillingInvoiceDocument | null> {
  const snapshot = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.INVOICES)
    .where('parentEmail', '==', normalizeEmail(params.parentEmail))
    .where('status', '==', 'paid')
    .get();

  const paidInvoiceDoc = snapshot.docs.find((doc) => {
    const invoice = {
      id: doc.id,
      ...(doc.data() as Omit<BillingInvoiceDocument, 'id'>),
    } as BillingInvoiceDocument;

    return isAdmissionInvoiceForStudent(invoice, params.studentId, params.studentEmail);
  });

  if (!paidInvoiceDoc) {
    return null;
  }

  return {
    id: paidInvoiceDoc.id,
    ...(paidInvoiceDoc.data() as Omit<BillingInvoiceDocument, 'id'>),
  } as BillingInvoiceDocument;
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
        `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 600; color: #0f172a;">${item.label}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${item.description}</div>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; white-space: nowrap; font-weight: 600; color: #0f172a;">
              ${formatCurrency(item.amount * item.quantity)}
            </td>
          </tr>
        `,
    )
    .join('');

  const settings = await getBillingSettings();
  const supportEmail = settings.supportEmail || process.env.SMTP_FROM_EMAIL || '';
  const supportPhone = settings.supportPhone || '';
  const supportLine = supportEmail || supportPhone
    ? `
      <div style="margin-top: 24px; padding: 16px 18px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe;">
        <div style="font-size: 13px; font-weight: 700; color: #1d4ed8; letter-spacing: 0.03em; text-transform: uppercase;">Need help?</div>
        <div style="margin-top: 8px; font-size: 14px; color: #334155;">
          ${supportEmail ? `Email: <span style="font-weight: 600;">${supportEmail}</span>` : ''}
          ${supportEmail && supportPhone ? '<br />' : ''}
          ${supportPhone ? `Phone: <span style="font-weight: 600;">${supportPhone}</span>` : ''}
        </div>
      </div>
    `
    : '';

  const html = `
    <div style="margin:0; padding:32px 16px; background:#f8fafc; font-family: Arial, Helvetica, sans-serif; color:#0f172a;">
      <div style="max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #dbeafe; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff;">
          <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.9;">Dr U Education</div>
          <h1 style="margin: 12px 0 0; font-size: 30px; line-height: 1.2;">Payment Request</h1>
          <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.88);">
            This is a system-generated payment link for your DR U Education billing request.
          </p>
        </div>

        <div style="padding: 28px 32px;">
          <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7;">Hello ${invoice.parentName || 'Parent'},</p>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #334155;">
            Dr U Education has generated a payment request for <strong>${feeLabels}</strong>. Please use the secure link below to complete payment.
          </p>

          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px;">
            <div style="padding: 16px 18px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Invoice</div>
              <div style="margin-top: 8px; font-size: 18px; font-weight: 700;">${invoice.invoiceNumber}</div>
            </div>
            <div style="padding: 16px 18px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Due Date</div>
              <div style="margin-top: 8px; font-size: 18px; font-weight: 700;">${dueAt ? dueAt.toLocaleDateString('en-AU') : 'As soon as possible'}</div>
            </div>
            ${
              invoice.studentName
                ? `
                <div style="padding: 16px 18px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; grid-column: span 2;">
                  <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Student</div>
                  <div style="margin-top: 8px; font-size: 18px; font-weight: 700;">${invoice.studentName}</div>
                </div>
              `
                : ''
            }
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            <tbody>${lineItemsHtml}</tbody>
            <tfoot>
              <tr>
                <td style="padding-top: 18px; font-size: 15px; font-weight: 700;">Total</td>
                <td style="padding-top: 18px; text-align: right; font-size: 24px; font-weight: 800; color: #0f172a;">
                  ${formatCurrency(invoice.amountTotal)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style="margin: 32px 0 20px; text-align: center;">
            <a href="${invoice.paymentUrl}" style="display: inline-block; background:#2563eb; color:#fff; padding:14px 26px; text-decoration:none; border-radius:14px; font-weight:700; font-size:15px;">
              Pay Securely with Card
            </a>
          </div>

          <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">
            Once payment is confirmed, Dr U Education will automatically update the billing record and parent portal access.
          </p>

          ${supportLine}

          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 1.7; color: #64748b;">
            This is a system-generated email from Dr U Education. Please do not reply directly to this message.
          </div>
        </div>
      </div>
    </div>
  `;

  return sendGenericEmail(
    invoice.parentEmail,
    `Dr U Education invoice ${invoice.invoiceNumber}`,
    html,
  );
}

async function sendInvoiceEmailAndStamp(invoice: BillingInvoiceDocument) {
  const emailResult = await sendInvoiceEmail(invoice);

  if (!emailResult.success) {
    throw new Error(`Payment link email could not be sent: ${emailResult.error || 'Unknown email error'}`);
  }

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoice.id).set(
    {
      emailSentAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    },
    { merge: true },
  );

  return emailResult;
}

async function sendPaidInvoiceEmail(invoice: BillingInvoiceDocument) {
  const paidAt = toDate(invoice.paidAt);
  const lineItemsHtml = invoice.lineItems
    .map(
      (item) =>
        `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 600; color: #0f172a;">${item.label}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${item.description}</div>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; white-space: nowrap; font-weight: 600; color: #0f172a;">
              ${formatCurrency(item.amount * item.quantity)}
            </td>
          </tr>
        `,
    )
    .join('');

  const settings = await getBillingSettings();
  const supportEmail = settings.supportEmail || process.env.SMTP_FROM_EMAIL || '';
  const supportPhone = settings.supportPhone || '';
  const supportLine = supportEmail || supportPhone
    ? `
      <div style="margin-top: 24px; padding: 16px 18px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe;">
        <div style="font-size: 13px; font-weight: 700; color: #1d4ed8; letter-spacing: 0.03em; text-transform: uppercase;">Need help?</div>
        <div style="margin-top: 8px; font-size: 14px; color: #334155;">
          ${supportEmail ? `Email: <span style="font-weight: 600;">${supportEmail}</span>` : ''}
          ${supportEmail && supportPhone ? '<br />' : ''}
          ${supportPhone ? `Phone: <span style="font-weight: 600;">${supportPhone}</span>` : ''}
        </div>
      </div>
    `
    : '';

  const html = `
    <div style="margin:0; padding:32px 16px; background:#f8fafc; font-family: Arial, Helvetica, sans-serif; color:#0f172a;">
      <div style="max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #dbeafe; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, #0f9d58 0%, #15803d 100%); color: #ffffff;">
          <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.9;">Dr U Education</div>
          <h1 style="margin: 12px 0 0; font-size: 30px; line-height: 1.2;">Payment Confirmed</h1>
          <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.88);">
            Your invoice has been cleared successfully. Please keep this email as your payment receipt.
          </p>
        </div>

        <div style="padding: 28px 32px;">
          <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7;">Hello ${invoice.parentName || 'Parent'},</p>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #334155;">
            Dr U Education has received your payment and cleared invoice <strong>${invoice.invoiceNumber}</strong>.
          </p>

          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px;">
            <div style="padding: 16px 18px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Invoice</div>
              <div style="margin-top: 8px; font-size: 18px; font-weight: 700;">${invoice.invoiceNumber}</div>
            </div>
            <div style="padding: 16px 18px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Paid On</div>
              <div style="margin-top: 8px; font-size: 18px; font-weight: 700;">${paidAt ? paidAt.toLocaleDateString('en-AU') : 'Today'}</div>
            </div>
            ${
              invoice.studentName
                ? `
                <div style="padding: 16px 18px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; grid-column: span 2;">
                  <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Student</div>
                  <div style="margin-top: 8px; font-size: 18px; font-weight: 700;">${invoice.studentName}</div>
                </div>
              `
                : ''
            }
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            <tbody>${lineItemsHtml}</tbody>
            <tfoot>
              <tr>
                <td style="padding-top: 18px; font-size: 15px; font-weight: 700;">Total Paid</td>
                <td style="padding-top: 18px; text-align: right; font-size: 24px; font-weight: 800; color: #0f172a;">
                  ${formatCurrency(invoice.amountTotal)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 24px; padding: 16px 18px; border-radius: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; font-size: 14px; line-height: 1.7; color: #166534;">
            This invoice is now marked as <strong>paid</strong> in Dr U Education.
          </div>

          ${supportLine}

          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 1.7; color: #64748b;">
            This is a system-generated email from Dr U Education. Please do not reply directly to this message.
          </div>
        </div>
      </div>
    </div>
  `;

  return sendGenericEmail(
    invoice.parentEmail,
    `Dr U Education paid invoice ${invoice.invoiceNumber}`,
    html,
  );
}

async function sendPaidInvoiceEmailAndStamp(invoice: BillingInvoiceDocument) {
  if (invoice.paidReceiptSentAt) {
    return { success: true, alreadySent: true };
  }

  const emailResult = await sendPaidInvoiceEmail(invoice);

  if (emailResult.success) {
    await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoice.id).set(
      {
        paidReceiptSentAt: nowTimestamp(),
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
  const initials = generateAvatarInitials(request.student.name);

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
  const enrollmentsCollection = firebaseAdmin.db.collection('studentEnrollments');

  const existingEnrollment = await firebaseAdmin.db
    .collection('studentEnrollments')
    .where('studentId', '==', studentId)
    .where('classId', '==', request.classId)
    .limit(1)
    .get();

  if (!existingEnrollment.empty) {
    return existingEnrollment.docs[0].id;
  }

  // Deterministic doc IDs avoid duplicate enrollments when approve is retried concurrently.
  const enrollmentRef = enrollmentsCollection.doc(`${studentId}_${request.classId}`);
  try {
    await enrollmentRef.create({
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
  } catch (error) {
    if (!isFirestoreAlreadyExistsError(error)) {
      throw error;
    }
  }

  const activeEnrollmentSnapshot = await enrollmentsCollection
    .where('studentId', '==', studentId)
    .where('status', '==', 'Active')
    .get();
  const uniqueActiveClassCount = new Set(
    activeEnrollmentSnapshot.docs
      .map((doc) => (doc.data() as { classId?: string }).classId || '')
      .filter(Boolean),
  ).size;

  await firebaseAdmin.firestore.updateDoc('students', studentId, {
    coursesEnrolled: uniqueActiveClassCount,
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

async function recordStripeBillingPayment(
  invoice: BillingInvoiceDocument,
  session: Stripe.Checkout.Session,
) {
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : undefined;

  const existingPaymentSnapshot = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.PAYMENTS)
    .where('invoiceId', '==', invoice.id)
    .where('provider', '==', 'stripe')
    .limit(1)
    .get();

  if (!existingPaymentSnapshot.empty) {
    const existingPaymentRef = existingPaymentSnapshot.docs[0].ref;
    await existingPaymentRef.set(
      {
        status: 'succeeded',
        amount: invoice.amountTotal,
        currency: invoice.currency,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        processedAt: nowTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.PAYMENTS).add({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    provider: 'stripe',
    status: 'succeeded',
    amount: invoice.amountTotal,
    currency: invoice.currency,
    parentEmail: invoice.parentEmail,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    processedAt: nowTimestamp(),
    createdAt: nowTimestamp(),
  });
}

async function finalizePaidBillingInvoice(
  invoice: BillingInvoiceDocument,
  session: Stripe.Checkout.Session,
) {
  const invoiceRef = firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoice.id);
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : undefined;
  const paidInvoice: BillingInvoiceDocument = {
    ...invoice,
    status: 'paid',
    paidAt: nowTimestamp(),
    checkoutCompletedAt: nowTimestamp(),
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    updatedAt: nowTimestamp(),
  } as BillingInvoiceDocument;

  await invoiceRef.set(
    {
      status: paidInvoice.status,
      billingStatus: 'paid',
      paidAt: paidInvoice.paidAt,
      checkoutCompletedAt: paidInvoice.checkoutCompletedAt,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paidInvoice.stripePaymentIntentId,
      updatedAt: paidInvoice.updatedAt,
    },
    { merge: true },
  );

  await recordStripeBillingPayment(invoice, session);

  if (hasBillingFee(invoice.lineItems, 'parent_portal_yearly')) {
    await activateParentPortalEntitlement(paidInvoice);
  }

  if (!invoice.enrollmentRequestId) {
    await invoiceRef.set(
      {
        finalization: {
          status: 'completed',
          completedAt: nowTimestamp(),
        },
        updatedAt: nowTimestamp(),
      },
      { merge: true },
    );
    await sendPaidInvoiceEmailAndStamp(paidInvoice);
    return { invoiceId: invoice.id, finalizedWithoutEnrollment: true };
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
      updatedAt: nowTimestamp(),
    },
    { merge: true },
  );

  await sendPaidInvoiceEmailAndStamp(paidInvoice);

  return { invoiceId: invoice.id, studentId };
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

  const discounts = await getApplicableBillingDiscounts({
    parentEmail: request.parent.email,
    studentId: existingStudent?.id,
    studentEmail: request.student.email,
    feeCodes: lineItems.map((item) => item.type),
  });
  const discountedLineItems = applyDiscountsToLineItems(lineItems, discounts);

  const dueAt = addDays(new Date(), settings.invoiceDueDays);
  const invoiceToken = buildInvoiceToken();
  const invoiceNumber = buildInvoiceNumber();
  const amountTotal = getBillingInvoiceTotal(discountedLineItems);

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
    lineItems: discountedLineItems,
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

  // Idempotency guard for repeated approvals on the same request.
  const existingStudentId = (request as { studentId?: string }).studentId;
  if (request.status === 'Approved' && existingStudentId) {
    return { studentId: existingStudentId };
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

export async function applyCouponCodeToBillingInvoice(params: {
  invoiceToken: string;
  couponCode: string;
}) {
  const invoice = await getBillingInvoiceByToken(params.invoiceToken);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status !== 'pending') {
    throw new Error('Coupon can only be applied to unpaid invoices');
  }

  const feeCodes = Array.from(new Set(invoice.lineItems.map((item) => item.type)));
  const discounts = await getApplicableBillingDiscounts({
    parentEmail: invoice.parentEmail,
    studentId: invoice.metadata?.studentId,
    feeCodes,
    couponCode: params.couponCode,
  });

  if (discounts.length === 0) {
    throw new Error('Coupon code is not valid for this invoice');
  }

  const alreadyApplied = discounts.every((discount) =>
    invoice.lineItems.some((item) => item.appliedDiscountIds?.includes(discount.id)),
  );
  if (alreadyApplied) {
    throw new Error('Coupon code is already applied to this invoice');
  }

  const lineItems = applyAdditionalDiscountsToLineItems(invoice.lineItems, discounts);
  const amountTotal = getBillingInvoiceTotal(lineItems);

  await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoice.id).set(
    {
      lineItems,
      amountTotal,
      updatedAt: nowTimestamp(),
    },
    { merge: true },
  );

  return {
    ...invoice,
    lineItems,
    amountTotal,
  } as BillingInvoiceDocument;
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
        .filter((invoice) => isAdmissionInvoiceForStudent(invoice, doc.id, studentEmail));

      const outstandingInvoices = admissionInvoices
        .filter((invoice) => invoice.status === 'pending')
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
        .map((invoice) => {
          const lineTotal = getAdmissionLineItemsForStudent(invoice, doc.id, studentEmail)
            .reduce((sum, item) => sum + Number(item.amount || 0) * Number(item.quantity || 1), 0);

          return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amountTotal: lineTotal || invoice.amountTotal,
            currency: invoice.currency,
            dueAt: toDate(invoice.dueAt)?.toISOString() || null,
            status: invoice.status,
          };
        });

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
  discountIds?: string[];
  couponCode?: string;
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
  const discounts = await getApplicableBillingDiscounts({
    parentEmail: normalizedParentEmail,
    studentId: student?.id,
    studentEmail: student?.email,
    feeCodes: params.feeCodes,
    discountIds: params.discountIds,
    couponCode: params.couponCode,
  });
  const discountedLineItems = applyDiscountsToLineItems(lineItems, discounts);
  const amountTotal = getBillingInvoiceTotal(discountedLineItems);
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
    lineItems: discountedLineItems,
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

type BillingCartItem = {
  feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
  studentId?: string;
};

function getAdmissionLineItemsForStudent(
  invoice: BillingInvoiceDocument,
  studentId: string,
  studentEmail: string,
) {
  const normalizedStudentEmail = normalizeEmail(studentEmail);
  return invoice.lineItems.filter(
    (item) =>
      item.type === 'admission_fee' &&
      (item.studentId === studentId ||
        (!!normalizedStudentEmail && normalizeEmail(item.studentEmail || '') === normalizedStudentEmail) ||
        invoice.metadata?.studentId === studentId ||
        (!!normalizedStudentEmail && invoice.studentEmail === normalizedStudentEmail)),
  );
}

function getBillingCartKeys(invoice: BillingInvoiceDocument) {
  const keys = new Set<string>();

  invoice.lineItems.forEach((item) => {
    if (item.type === 'parent_portal_yearly') {
      keys.add('parent_portal_yearly');
      return;
    }

    if (item.type === 'admission_fee') {
      const studentKey =
        item.studentId ||
        invoice.metadata?.studentId ||
        normalizeEmail(item.studentEmail || '') ||
        normalizeEmail(invoice.studentEmail || '');
      if (studentKey) {
        keys.add(`admission_fee:${studentKey}`);
      }
    }
  });

  return keys;
}

function sameBillingCart(invoice: BillingInvoiceDocument, expectedKeys: Set<string>) {
  const invoiceKeys = getBillingCartKeys(invoice);
  if (invoiceKeys.size !== expectedKeys.size) return false;
  return Array.from(expectedKeys).every((key) => invoiceKeys.has(key));
}

export async function sendBillingPaymentCartLink(params: {
  parentEmail: string;
  items: BillingCartItem[];
  discountIds?: string[];
  couponCode?: string;
  origin?: string;
}) {
  const normalizedParentEmail = normalizeEmail(params.parentEmail);
  const normalizedItems = params.items
    .filter((item) => Array.isArray(item.feeCodes) && item.feeCodes.length > 0)
    .map((item) => ({
      studentId: item.studentId,
      feeCodes: Array.from(new Set(item.feeCodes)),
    }));

  const wantsPortal = normalizedItems.some((item) => item.feeCodes.includes('parent_portal_yearly'));
  const admissionStudentIds = Array.from(
    new Set(
      normalizedItems
        .filter((item) => item.feeCodes.includes('admission_fee'))
        .map((item) => item.studentId)
        .filter((studentId): studentId is string => Boolean(studentId)),
    ),
  );

  if (!wantsPortal && admissionStudentIds.length === 0) {
    throw new Error('Select at least one fee for the cart invoice');
  }

  const settings = await getBillingSettings();
  const parent = await getParentByEmail(normalizedParentEmail);
  const students = await Promise.all(admissionStudentIds.map((studentId) => getStudentById(studentId)));
  const missingStudent = admissionStudentIds.find((studentId, index) => !students[index]);
  if (missingStudent) {
    throw new Error(`Student not found for ${missingStudent}`);
  }

  const typedStudents = students.filter(Boolean) as Array<StudentDocument & { id: string }>;
  const wrongParentStudent = typedStudents.find(
    (student) => normalizeEmail(student.parent.email) !== normalizedParentEmail,
  );
  if (wrongParentStudent) {
    throw new Error(`${wrongParentStudent.name} does not belong to this parent`);
  }

  if (wantsPortal) {
    const entitlement = await getParentPortalEntitlementByEmail(normalizedParentEmail);
    if (isEntitlementActive(entitlement)) {
      throw new Error('Parent portal access is already active for this parent');
    }
  }

  for (const student of typedStudents) {
    const paidAdmissionInvoice = await getPaidAdmissionInvoiceForStudent({
      parentEmail: normalizedParentEmail,
      studentId: student.id,
      studentEmail: student.email,
    });

    if (paidAdmissionInvoice) {
      throw new Error(`Admission fee is already paid for ${student.name}`);
    }
  }

  const parentName = String(
    parent?.displayName || parent?.name || typedStudents[0]?.parent.name || 'Parent',
  );
  const parentPhone = String(parent?.phone || typedStudents[0]?.parent.phone || '');
  const lineItems: BillingLineItem[] = [];

  if (wantsPortal) {
    lineItems.push(
      buildBillingLineItem(
        'parent_portal_yearly',
        settings,
        {
          parentEmail: normalizedParentEmail,
          parentName,
          studentEmail: typedStudents[0]?.email ? normalizeEmail(typedStudents[0].email) : '',
          studentName: typedStudents[0]?.name || 'Current student',
          className: 'Existing student access',
          subject: 'Parent Portal',
          centerName: 'DRU EDU',
        },
      ),
    );
  }

  for (const student of typedStudents) {
    const lineItem = buildBillingLineItem(
      'admission_fee',
      settings,
      {
        parentEmail: normalizedParentEmail,
        parentName,
        studentEmail: normalizeEmail(student.email),
        studentName: student.name,
        className: 'Existing student access',
        subject: 'Admission',
        centerName: 'DRU EDU',
      },
    );
    lineItems.push({
      ...lineItem,
      studentId: student.id,
    });
  }

  const discountedLineItems = (
    await Promise.all(
      lineItems.map(async (lineItem) => {
        const student = lineItem.studentId
          ? typedStudents.find((candidate) => candidate.id === lineItem.studentId)
          : undefined;
        const discounts = await getApplicableBillingDiscounts({
          parentEmail: normalizedParentEmail,
          studentId: student?.id,
          studentEmail: student?.email,
          feeCodes: [lineItem.type],
          discountIds: params.discountIds,
          couponCode: params.couponCode,
        });
        return applyDiscountsToLineItems([lineItem], discounts)[0];
      }),
    )
  ).filter(Boolean);

  const expectedKeys = new Set<string>();
  if (wantsPortal) expectedKeys.add('parent_portal_yearly');
  typedStudents.forEach((student) => expectedKeys.add(`admission_fee:${student.id}`));

  const existingPendingInvoices = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.INVOICES)
    .where('parentEmail', '==', normalizedParentEmail)
    .where('status', '==', 'pending')
    .get();

  const existingInvoiceDoc = existingPendingInvoices.docs.find((doc) => {
    const invoice = {
      id: doc.id,
      ...(doc.data() as Omit<BillingInvoiceDocument, 'id'>),
    } as BillingInvoiceDocument;
    return sameBillingCart(invoice, expectedKeys) && !params.couponCode && !(params.discountIds || []).length;
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
      feeLabel: 'Cart invoice',
      reused: true,
      itemCount: expectedKeys.size,
    };
  }

  const dueAt = addDays(new Date(), settings.invoiceDueDays);
  const invoiceToken = buildInvoiceToken();
  const invoiceNumber = buildInvoiceNumber();
  const amountTotal = getBillingInvoiceTotal(discountedLineItems);
  const primaryStudent = typedStudents[0];

  const invoicePayload = {
    invoiceNumber,
    invoiceToken,
    parentEmail: normalizedParentEmail,
    parentName,
    parentPhone: parentPhone || undefined,
    studentEmail: primaryStudent?.email ? normalizeEmail(primaryStudent.email) : '',
    studentName: primaryStudent?.name || 'Multiple students',
    enrollmentRequestId: '',
    classId: '',
    className: 'Existing student access',
    subject: 'Billing',
    centerName: 'DRU EDU',
    currency: settings.currency,
    status: 'pending',
    lineItems: discountedLineItems,
    amountTotal,
    dueAt: admin.firestore.Timestamp.fromDate(dueAt),
    paymentUrl: buildInvoiceUrl(invoiceToken, params.origin),
    finalization: {
      status: 'pending',
    },
    metadata: {
      isNewStudent: false,
      portalFeeRequired: wantsPortal,
      studentId: primaryStudent?.id,
      studentIds: typedStudents.map((student) => student.id),
    },
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };

  const invoiceRef = await firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).add(invoicePayload);
  const invoice = { id: invoiceRef.id, ...invoicePayload } as BillingInvoiceDocument;
  await sendInvoiceEmailAndStamp(invoice);

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    paymentUrl: invoice.paymentUrl,
    feeLabel: 'Cart invoice',
    reused: false,
    itemCount: expectedKeys.size,
  };
}

export async function sendBillingPaymentLink(params: {
  feeCode?: 'admission_fee' | 'parent_portal_yearly';
  feeCodes?: Array<'admission_fee' | 'parent_portal_yearly'>;
  parentEmail: string;
  studentId?: string;
  discountIds?: string[];
  couponCode?: string;
  origin?: string;
}) {
  const feeCodes = Array.from(
    new Set(
      (params.feeCodes && params.feeCodes.length > 0
        ? params.feeCodes
        : params.feeCode
          ? [params.feeCode]
          : []) as Array<'admission_fee' | 'parent_portal_yearly'>,
    ),
  );

  if (feeCodes.length === 0) {
    throw new Error('At least one billing fee is required');
  }

  if (feeCodes.includes('admission_fee') && !params.studentId) {
    throw new Error('Student is required when sending an admission fee invoice');
  }

  const feeLabels = feeCodes.map((feeCode) => getBillingFeeDefinition(feeCode).label);
  const normalizedParentEmail = normalizeEmail(params.parentEmail);
  const student = params.studentId ? await getStudentById(params.studentId) : null;

  if (feeCodes.includes('parent_portal_yearly')) {
    const entitlement = await getParentPortalEntitlementByEmail(normalizedParentEmail);
    if (isEntitlementActive(entitlement)) {
      throw new Error('Parent portal access is already active for this parent');
    }
  }

  if (feeCodes.includes('admission_fee') && student && params.studentId) {
    const paidAdmissionInvoice = await getPaidAdmissionInvoiceForStudent({
      parentEmail: normalizedParentEmail,
      studentId: params.studentId,
      studentEmail: student.email,
    });

    if (paidAdmissionInvoice) {
      throw new Error('Admission fee is already paid for this student');
    }
  }

  const existingPendingInvoices = await firebaseAdmin.db
    .collection(BILLING_COLLECTIONS.INVOICES)
    .where('parentEmail', '==', normalizedParentEmail)
    .where('status', '==', 'pending')
    .get();

  const existingInvoiceDoc = existingPendingInvoices.docs.find((doc) => {
    const invoice = doc.data() as BillingInvoiceDocument;
    const requiredDiscountIds = params.discountIds || [];
    const hasRequiredDiscounts =
      requiredDiscountIds.length === 0 ||
      requiredDiscountIds.every((discountId) =>
        invoice.lineItems.some((item) => item.appliedDiscountIds?.includes(discountId)),
      );
    const sameFeeSet =
      invoice.lineItems.length === feeCodes.length &&
      feeCodes.every((feeCode) => hasBillingFee(invoice.lineItems, feeCode));
    const sameStudent =
      !feeCodes.includes('admission_fee') ||
      invoice.metadata?.studentId === params.studentId ||
      invoice.studentEmail === normalizeEmail(student?.email || '');
    return sameFeeSet && sameStudent && hasRequiredDiscounts && !params.couponCode;
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
      feeLabel: feeLabels.join(' + '),
      reused: true,
    };
  }

  const invoice = await createBillingInvoiceRequest({
    feeCodes,
    parentEmail: normalizedParentEmail,
    studentId: params.studentId,
    discountIds: params.discountIds,
    couponCode: params.couponCode,
    origin: params.origin,
  });

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    paymentUrl: invoice.paymentUrl,
    feeLabel: feeLabels.join(' + '),
    reused: false,
  };
}

export async function sendBulkBillingPaymentLinks(params: {
  items: Array<{
    parentEmail: string;
    studentId?: string;
    feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
  }>;
  origin?: string;
}) {
  const dedupedItems = Array.from(
    new Map(
      params.items
        .filter((item) => item.parentEmail && Array.isArray(item.feeCodes) && item.feeCodes.length > 0)
        .map((item) => {
          const feeCodes = Array.from(new Set(item.feeCodes)).sort();
          const key = `${normalizeEmail(item.parentEmail)}::${item.studentId || ''}::${feeCodes.join('+')}`;
          return [
            key,
            {
              parentEmail: normalizeEmail(item.parentEmail),
              studentId: item.studentId,
              feeCodes,
            },
          ] as const;
        }),
    ).values(),
  );

  const results: Array<{
    parentEmail: string;
    studentId?: string;
    feeLabel?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    paymentUrl?: string;
    reused?: boolean;
    success: boolean;
    error?: string;
  }> = [];

  for (const item of dedupedItems) {
    try {
      const result = await sendBillingPaymentLink({
        feeCodes: item.feeCodes,
        parentEmail: item.parentEmail,
        studentId: item.studentId,
        origin: params.origin,
      });

      results.push({
        parentEmail: item.parentEmail,
        studentId: item.studentId,
        feeLabel: result.feeLabel,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        paymentUrl: result.paymentUrl,
        reused: result.reused,
        success: true,
      });
    } catch (error: any) {
      results.push({
        parentEmail: item.parentEmail,
        studentId: item.studentId,
        success: false,
        error: error?.message || 'Failed to send payment link',
      });
    }
  }

  return {
    total: results.length,
    sent: results.filter((item) => item.success).length,
    reused: results.filter((item) => item.success && item.reused).length,
    failed: results.filter((item) => !item.success).length,
    results,
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

  const paidAdmissionInvoice = await getPaidAdmissionInvoiceForStudent({
    parentEmail: normalizedParentEmail,
    studentId: params.studentId,
    studentEmail: student.email,
  });

  if (paidAdmissionInvoice) {
    throw new Error('Admission fee is already paid for this student');
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
  let paidInvoice: BillingInvoiceDocument | null = null;

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
    paidInvoice = {
      ...data,
      id: invoiceId,
      status: 'paid',
      paidAt,
      updatedAt: paidAt,
      finalization: {
        status: 'completed',
        completedAt: paidAt,
      },
    } as BillingInvoiceDocument;
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
    paidInvoice = {
      ...invoice,
      status: 'paid',
      paidAt,
      updatedAt: paidAt,
      finalization: {
        status: 'completed',
        completedAt: paidAt,
      },
    } as BillingInvoiceDocument;
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

  if (paidInvoice) {
    await sendPaidInvoiceEmailAndStamp(paidInvoice);
  }

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

  if (isEntitlementActive(existingEntitlement)) {
    throw new Error('Parent portal access is already active for this parent');
  }

  const primaryStudent = students[0];
  const parentName =
    String(parent?.displayName || parent?.name || primaryStudent?.name || 'Parent');
  const parentPhone =
    String(parent?.phone || '') || undefined;

  let invoiceId = '';
  let invoiceNumber = '';
  let amountTotal = settings.parentPortalYearlyFeeAmount;
  const paidAt = nowTimestamp();
  let paidInvoice: BillingInvoiceDocument | null = null;

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
    paidInvoice = {
      ...data,
      id: invoiceId,
      status: 'paid',
      paidAt,
      updatedAt: paidAt,
      finalization: {
        status: 'completed',
        completedAt: paidAt,
      },
    } as BillingInvoiceDocument;
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
    paidInvoice = {
      id: invoiceId,
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
    } as BillingInvoiceDocument;
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

  await activateParentPortalEntitlement(
    paidInvoice ||
      ({
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
      } as BillingInvoiceDocument),
  );

  if (paidInvoice) {
    await sendPaidInvoiceEmailAndStamp(paidInvoice);
  }

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

  try {
    await finalizePaidBillingInvoice(invoice, session);
  } catch (error: any) {
    const invoiceRef = firebaseAdmin.db.collection(BILLING_COLLECTIONS.INVOICES).doc(invoiceId);
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

export async function reconcileBillingCheckoutSession(sessionId: string) {
  if (!sessionId) {
    throw new Error('Session id is required');
  }

  const stripe = ensureStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const invoiceId = session.metadata?.invoiceId;

  if (!invoiceId) {
    throw new Error('Missing invoiceId in Stripe session metadata');
  }

  const invoice = await getBillingInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error(`Billing invoice not found for ${invoiceId}`);
  }

  if (session.payment_status !== 'paid') {
    return {
      invoiceId,
      status: invoice.status,
      paymentStatus: session.payment_status,
      reconciled: false,
    };
  }

  if (invoice.finalization?.status === 'completed' && invoice.status === 'paid') {
    return {
      invoiceId,
      status: invoice.status,
      paymentStatus: session.payment_status,
      reconciled: false,
      alreadyFinalized: true,
    };
  }

  await finalizePaidBillingInvoice(invoice, session);

  return {
    invoiceId,
    status: 'paid',
    paymentStatus: session.payment_status,
    reconciled: true,
  };
}

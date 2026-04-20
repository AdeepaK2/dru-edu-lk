export type BillingDateValue =
  | Date
  | string
  | {
      toDate?: () => Date;
    };

export const BILLING_COLLECTIONS = {
  SETTINGS: 'billingSettings',
  INVOICES: 'billingInvoices',
  PAYMENTS: 'billingPayments',
  PARENT_PORTAL_ENTITLEMENTS: 'parentPortalEntitlements',
  EVENTS: 'billingEvents',
  PARENT_INVITES: 'parentInvites',
  DISCOUNTS: 'billingDiscounts',
} as const;

export type BillingInvoiceStatus =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'void'
  | 'failed';

export type BillingFeeCode = 'admission_fee' | 'parent_portal_yearly';
export type BillingFeeScope = 'student' | 'parent';
export type BillingDiscountScope = 'parent' | 'student';
export type BillingDiscountType = 'percentage' | 'fixed';

export interface BillingSettings {
  admissionFeeAmount: number;
  parentPortalYearlyFeeAmount: number;
  currency: 'AUD';
  invoiceDueDays: number;
  reminderDaysBeforeDue: number[];
  supportEmail?: string;
  supportPhone?: string;
}

export interface BillingSettingsDocument extends BillingSettings {
  updatedAt: BillingDateValue;
  updatedBy?: string;
}

export interface BillingFeeContext {
  parentEmail?: string;
  parentName?: string;
  studentEmail?: string;
  studentName?: string;
  className?: string;
  subject?: string;
  centerName?: string;
}

export interface BillingFeeDefinition {
  code: BillingFeeCode;
  label: string;
  scope: BillingFeeScope;
  getAmount: (settings: BillingSettings) => number;
  getDescription: (context: BillingFeeContext) => string;
}

export interface BillingLineItem {
  type: BillingFeeCode;
  label: string;
  description: string;
  amount: number;
  quantity: number;
  studentEmail?: string;
  studentName?: string;
  originalAmount?: number;
  discountAmount?: number;
  appliedDiscountIds?: string[];
}

export interface BillingInvoiceDocument {
  id: string;
  invoiceNumber: string;
  invoiceToken: string;
  parentEmail: string;
  parentName: string;
  parentPhone?: string;
  studentEmail: string;
  studentName: string;
  enrollmentRequestId: string;
  classId: string;
  className: string;
  subject: string;
  centerName: string;
  currency: 'AUD';
  status: BillingInvoiceStatus;
  lineItems: BillingLineItem[];
  amountTotal: number;
  dueAt: BillingDateValue;
  paymentUrl?: string;
  emailSentAt?: BillingDateValue;
  paidReceiptSentAt?: BillingDateValue;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: BillingDateValue;
  checkoutCompletedAt?: BillingDateValue;
  finalization?: {
    status: 'pending' | 'completed' | 'failed';
    completedAt?: BillingDateValue;
    error?: string;
  };
  metadata: {
    isNewStudent: boolean;
    portalFeeRequired: boolean;
    studentId?: string;
  };
  createdAt: BillingDateValue;
  updatedAt: BillingDateValue;
}

export interface BillingPaymentDocument {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  provider: 'stripe' | 'manual';
  status: 'succeeded' | 'failed';
  amount: number;
  currency: 'AUD';
  parentEmail: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  notes?: string;
  processedBy?: string;
  processedAt: BillingDateValue;
  createdAt: BillingDateValue;
}

export interface ParentPortalEntitlementDocument {
  parentEmail: string;
  parentId?: string;
  status: 'active' | 'expired' | 'none';
  startAt?: BillingDateValue;
  endAt?: BillingDateValue;
  lastInvoiceId?: string;
  lastPaymentAt?: BillingDateValue;
  updatedAt: BillingDateValue;
  createdAt: BillingDateValue;
}

export interface BillingDiscountDocument {
  id: string;
  name: string;
  scope: BillingDiscountScope;
  type: BillingDiscountType;
  value: number;
  parentEmail: string;
  parentName?: string;
  studentId?: string;
  studentName?: string;
  feeCodes: BillingFeeCode[];
  reason?: string;
  isActive: boolean;
  createdAt: BillingDateValue;
  updatedAt: BillingDateValue;
  createdBy?: string;
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  admissionFeeAmount: 0,
  parentPortalYearlyFeeAmount: 0,
  currency: 'AUD',
  invoiceDueDays: 7,
  reminderDaysBeforeDue: [3, 1],
};

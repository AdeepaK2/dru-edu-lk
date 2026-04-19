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
} as const;

export type BillingInvoiceStatus =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'void'
  | 'failed';

export type BillingLineItemType = 'admission_fee' | 'parent_portal_yearly';

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

export interface BillingLineItem {
  type: BillingLineItemType;
  label: string;
  description: string;
  amount: number;
  quantity: number;
  studentEmail?: string;
  studentName?: string;
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

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  admissionFeeAmount: 0,
  parentPortalYearlyFeeAmount: 0,
  currency: 'AUD',
  invoiceDueDays: 7,
  reminderDaysBeforeDue: [3, 1],
};

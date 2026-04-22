export interface BillingSettingsState {
  admissionFeeAmount: number;
  parentPortalYearlyFeeAmount: number;
  invoiceDueDays: number;
  reminderDaysBeforeDue: string;
  supportEmail: string;
  supportPhone: string;
}

export interface BillingAccountStudent {
  studentId: string;
  studentName: string;
  studentEmail: string;
  year?: string;
  school?: string;
}

export interface BillingInvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  amountTotal: number;
  currency: string;
  dueAt: string | null;
  status: string;
}

export interface BillingPaymentRecord {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  paidAt: string | null;
  provider: 'stripe' | 'manual' | 'unknown';
}

export interface BillingAccount {
  parentId?: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  students: BillingAccountStudent[];
  portalStatus: 'active' | 'payment_required' | 'expired' | 'none';
  portalPaidUntil: string | null;
  totalOutstandingAmount: number;
  outstandingInvoices: BillingInvoiceRecord[];
  latestPayment: BillingPaymentRecord | null;
}

export interface AdmissionFeeRecord {
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
  outstandingInvoices: BillingInvoiceRecord[];
  latestPayment: BillingPaymentRecord | null;
}

export interface BillingDiscountRecord {
  id: string;
  name: string;
  scope: 'parent' | 'student';
  type: 'percentage' | 'fixed';
  value: number;
  parentEmail: string;
  parentName?: string;
  studentId?: string;
  studentName?: string;
  feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
  reason?: string;
  isActive: boolean;
  createdAt?: string | null;
}

export interface DiscountFormState {
  name: string;
  scope: 'parent' | 'student';
  type: 'percentage' | 'fixed';
  value: number;
  parentEmail: string;
  studentId: string;
  feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
  reason: string;
}

export interface BillingSummary {
  totalParents: number;
  activeParents: number;
  lockedParents: number;
  pendingInvoices: number;
  overdueInvoices: number;
  admissionPaidStudents: number;
  admissionPendingStudents: number;
}

export type BillingTab = 'parent_portal' | 'admission' | 'discounts' | 'settings';

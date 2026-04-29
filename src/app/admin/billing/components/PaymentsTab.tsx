import { useState } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import type {
  AdmissionFeeRecord,
  BillingAccount,
  BillingInvoiceRecord,
  BillingPaymentParentRow,
  BillingPaymentRecord,
  BillingPaymentStudent,
  FeePaymentStatus,
  FeePaymentStatusFilter,
  PaymentStatusFilter,
} from '../types';

type FeeCode = 'admission_fee' | 'parent_portal_yearly';
type PaymentActionMode = 'send' | 'offline';
type PaymentFeeSelection = 'portal' | 'admission' | 'both';
type SelectedBillingItem = {
  parentEmail: string;
  studentId?: string;
  feeCodes: FeeCode[];
};

interface PaymentActionModalState {
  row: BillingPaymentParentRow;
  mode: PaymentActionMode;
  selectedPortal: boolean;
  selectedStudentIds: string[];
}

interface PaymentsTabProps {
  rows: BillingPaymentParentRow[];
  filteredCount: number;
  totalCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  portalStatusFilter: FeePaymentStatusFilter;
  onPortalStatusFilterChange: (value: FeePaymentStatusFilter) => void;
  admissionStatusFilter: FeePaymentStatusFilter;
  onAdmissionStatusFilterChange: (value: FeePaymentStatusFilter) => void;
  paymentStatusFilter: PaymentStatusFilter;
  onPaymentStatusFilterChange: (value: PaymentStatusFilter) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  startIndex: number;
  endIndex: number;
  runBulkBillingAction: (args: {
    processingId: string;
    items: Array<{
      parentEmail: string;
      studentId?: string;
      feeCodes: FeeCode[];
    }>;
    successLabel: string;
  }) => boolean | Promise<boolean>;
  bulkPortalItems: Array<{
    parentEmail: string;
    feeCodes: Array<'parent_portal_yearly'>;
  }>;
  bulkAdmissionItems: Array<{
    parentEmail: string;
    studentId: string;
    feeCodes: Array<'admission_fee'>;
  }>;
  bulkCombinedItems: Array<{
    parentEmail: string;
    studentId?: string;
    feeCodes: FeeCode[];
  }>;
  processingKey: string | null;
  admissionFeeAmount: number;
  parentPortalYearlyFeeAmount: number;
  settingsLoading: boolean;
  managementLoading: boolean;
  runBillingAction: (args: {
    action: 'mark_paid_offline' | 'send_payment_link' | 'send_combined_payment_link';
    feeCode: FeeCode;
    parentEmail: string;
    studentId?: string;
    processingId: string;
  }) => boolean | Promise<boolean>;
  formatMoney: (amount: number, currency?: string) => string;
  formatDate: (value?: string | null) => string;
}

function paymentStatusLabel(status: FeePaymentStatus) {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'invoice_sent':
      return 'Invoice Sent';
    default:
      return 'Unpaid';
  }
}

function getFeeStatusTone(status: FeePaymentStatus) {
  switch (status) {
    case 'paid':
      return 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200';
    case 'invoice_sent':
      return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200';
  }
}

function FeeStatusIcon({ status }: { status: FeePaymentStatus }) {
  if (status === 'paid') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'invoice_sent') return <Clock3 className="h-4 w-4" />;
  return <XCircle className="h-4 w-4" />;
}

function InvoiceList({
  emptyLabel,
  formatDate,
  formatMoney,
  invoices,
}: {
  emptyLabel: string;
  formatDate: (value?: string | null) => string;
  formatMoney: (amount: number, currency?: string) => string;
  invoices: BillingPaymentParentRow['portalOutstandingInvoices'];
}) {
  if (invoices.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">{emptyLabel}</p>;
  }

  return (
    <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
      {invoices.map((invoice) => (
        <p key={invoice.invoiceId}>
          {invoice.invoiceNumber} - {formatMoney(invoice.amountTotal, invoice.currency)} - due {formatDate(invoice.dueAt)}
        </p>
      ))}
    </div>
  );
}

function PaymentSummary({
  emptyLabel,
  formatDate,
  formatMoney,
  payment,
}: {
  emptyLabel: string;
  formatDate: (value?: string | null) => string;
  formatMoney: (amount: number, currency?: string) => string;
  payment: BillingPaymentRecord | null;
}) {
  if (!payment) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">{emptyLabel}</p>;
  }

  return (
    <div className="text-xs text-gray-600 dark:text-gray-300">
      <p className="font-medium text-gray-900 dark:text-white">{payment.invoiceNumber}</p>
      <p>{formatMoney(payment.amount)}</p>
      <p className="capitalize text-gray-500 dark:text-gray-400">
        {payment.provider} - {formatDate(payment.paidAt)}
      </p>
    </div>
  );
}

function FeeStatusPanel({
  amount,
  emptyInvoiceLabel,
  emptyPaymentLabel,
  formatDate,
  formatMoney,
  invoices,
  label,
  payment,
  status,
  supportingText,
}: {
  amount: number;
  emptyInvoiceLabel: string;
  emptyPaymentLabel: string;
  formatDate: (value?: string | null) => string;
  formatMoney: (amount: number, currency?: string) => string;
  invoices: BillingInvoiceRecord[];
  label: string;
  payment: BillingPaymentRecord | null;
  status: FeePaymentStatus;
  supportingText?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
          {supportingText ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{supportingText}</p> : null}
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getFeeStatusTone(
            status,
          )}`}
        >
          <FeeStatusIcon status={status} />
          {paymentStatusLabel(status)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Outstanding</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(amount)}</p>
          <InvoiceList
            emptyLabel={emptyInvoiceLabel}
            formatDate={formatDate}
            formatMoney={formatMoney}
            invoices={invoices}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Latest payment</p>
          <div className="mt-1">
            <PaymentSummary
              emptyLabel={emptyPaymentLabel}
              formatDate={formatDate}
              formatMoney={formatMoney}
              payment={payment}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentFeeStatusBlock({
  formatDate,
  formatMoney,
  portalLatestPayment,
  portalOutstandingAmount,
  portalOutstandingInvoices,
  portalPaidUntil,
  portalPaymentStatus,
  student,
}: {
  formatDate: (value?: string | null) => string;
  formatMoney: (amount: number, currency?: string) => string;
  portalLatestPayment: BillingPaymentRecord | null;
  portalOutstandingAmount: number;
  portalOutstandingInvoices: BillingInvoiceRecord[];
  portalPaidUntil: string | null;
  portalPaymentStatus: FeePaymentStatus;
  student: BillingPaymentStudent;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-700/40">
      <div>
        <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Student</p>
        <p className="mt-1 font-medium text-gray-900 dark:text-white">{student.studentName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{student.studentEmail || 'No student email'}</p>
        {student.year || student.school ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {[student.year, student.school].filter(Boolean).join(' - ')}
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <FeeStatusPanel
          amount={portalOutstandingAmount}
          emptyInvoiceLabel="No unpaid portal invoices"
          emptyPaymentLabel="No portal payment recorded"
          formatDate={formatDate}
          formatMoney={formatMoney}
          invoices={portalOutstandingInvoices}
          label="Parent Portal Fee"
          payment={portalLatestPayment}
          status={portalPaymentStatus}
          supportingText={`Paid until ${formatDate(portalPaidUntil)}`}
        />
        <FeeStatusPanel
          amount={student.totalOutstandingAmount}
          emptyInvoiceLabel={student.canManageAdmission ? 'No unpaid admission invoices' : 'No admission record found'}
          emptyPaymentLabel="No admission payment recorded"
          formatDate={formatDate}
          formatMoney={formatMoney}
          invoices={student.outstandingInvoices}
          label="Admission Fee"
          payment={student.latestPayment}
          status={student.paymentStatus}
        />
      </div>
    </div>
  );
}

function ParentPortalOnlyBlock({
  formatDate,
  formatMoney,
  row,
}: {
  formatDate: (value?: string | null) => string;
  formatMoney: (amount: number, currency?: string) => string;
  row: BillingPaymentParentRow;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-700/40">
      <div>
        <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Parent account</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No linked students found</p>
      </div>
      <div className="mt-3">
        <FeeStatusPanel
          amount={row.portalOutstandingAmount}
          emptyInvoiceLabel="No unpaid portal invoices"
          emptyPaymentLabel="No portal payment recorded"
          formatDate={formatDate}
          formatMoney={formatMoney}
          invoices={row.portalOutstandingInvoices}
          label="Parent Portal Fee"
          payment={row.portalLatestPayment}
          status={row.portalPaymentStatus}
          supportingText={`Paid until ${formatDate(row.portalPaidUntil)}`}
        />
      </div>
    </div>
  );
}

function getManageableStudents(row: BillingPaymentParentRow) {
  return row.students.filter((student) => student.canManageAdmission);
}

function getDefaultActionState(row: BillingPaymentParentRow): PaymentActionModalState {
  const selectedStudentIds = getManageableStudents(row)
    .filter((student) => student.paymentStatus !== 'paid')
    .map((student) => student.studentId)
    .filter(Boolean);

  return {
    row,
    mode: 'send',
    selectedPortal: row.portalPaymentStatus !== 'paid',
    selectedStudentIds,
  };
}

function PaymentActionModal({
  admissionFeeAmount,
  formatMoney,
  modal,
  onChange,
  onClose,
  onSubmit,
  parentPortalYearlyFeeAmount,
  processingKey,
}: {
  admissionFeeAmount: number;
  formatMoney: (amount: number, currency?: string) => string;
  modal: PaymentActionModalState;
  onChange: (modal: PaymentActionModalState) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  parentPortalYearlyFeeAmount: number;
  processingKey: string | null;
}) {
  const { row } = modal;
  const manageableStudents = getManageableStudents(row);
  const selectedStudents = manageableStudents.filter((student) => modal.selectedStudentIds.includes(student.studentId));
  const isProcessing = Boolean(processingKey);
  const portalAmount = row.portalOutstandingAmount || parentPortalYearlyFeeAmount;
  const getAdmissionAmount = (student: BillingPaymentStudent) => student.totalOutstandingAmount || admissionFeeAmount;
  const cartTotal =
    (modal.selectedPortal ? portalAmount : 0) +
    selectedStudents.reduce((sum, student) => sum + getAdmissionAmount(student), 0);
  const selectedCount = (modal.selectedPortal ? 1 : 0) + selectedStudents.length;
  const portalDisabled =
    row.portalPaymentStatus === 'paid' || (modal.mode === 'send' && parentPortalYearlyFeeAmount <= 0);
  const admissionAmountMissing = modal.mode === 'send' && admissionFeeAmount <= 0;
  const sendDisabled =
    selectedCount === 0 ||
    (modal.selectedPortal && parentPortalYearlyFeeAmount <= 0) ||
    (modal.selectedStudentIds.length > 0 && admissionFeeAmount <= 0);
  const offlineDisabled =
    selectedCount === 0 ||
    (modal.selectedPortal && row.portalPaymentStatus === 'paid') ||
    selectedStudents.some((student) => student.paymentStatus === 'paid');
  const actionDisabled = isProcessing || (modal.mode === 'send' ? sendDisabled : offlineDisabled);

  const setMode = (mode: PaymentActionMode) => onChange({ ...modal, mode });
  const togglePortal = () => {
    if (portalDisabled) return;
    onChange({ ...modal, selectedPortal: !modal.selectedPortal });
  };
  const toggleStudent = (student: BillingPaymentStudent) => {
    if (student.paymentStatus === 'paid' || admissionAmountMissing) return;
    const selectedStudentIds = modal.selectedStudentIds.includes(student.studentId)
      ? modal.selectedStudentIds.filter((studentId) => studentId !== student.studentId)
      : [...modal.selectedStudentIds, student.studentId];
    onChange({ ...modal, selectedStudentIds });
  };
  const invoicePlan =
    modal.mode === 'offline'
      ? `${selectedCount} selected fee${selectedCount === 1 ? '' : 's'}`
      : modal.selectedPortal && selectedStudents.length === 1
        ? '1 combined invoice email'
        : `${selectedCount} invoice email${selectedCount === 1 ? '' : 's'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-blue-600 dark:text-blue-300">Manage Payment</p>
              <h3 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{row.parentName}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{row.parentEmail}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Action</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('send')}
                className={`rounded-xl border p-4 text-left ${
                  modal.mode === 'send'
                    ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-100'
                    : 'border-slate-200 text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <p className="font-semibold">Send invoice link</p>
                <p className="mt-1 text-sm opacity-80">Create or resend a Stripe payment link.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('offline')}
                className={`rounded-xl border p-4 text-left ${
                  modal.mode === 'offline'
                    ? 'border-green-500 bg-green-50 text-green-900 dark:border-green-400 dark:bg-green-900/20 dark:text-green-100'
                    : 'border-slate-200 text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <p className="font-semibold">Mark paid offline</p>
                <p className="mt-1 text-sm opacity-80">Record a bank/cash payment manually.</p>
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Choose fees</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Select the parent portal fee once, then select the admission fee for each student that should be included.
                </p>
              </div>

              <button
                type="button"
                onClick={togglePortal}
                disabled={portalDisabled}
                className={`w-full rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                  modal.selectedPortal
                    ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-100'
                    : 'border-slate-200 text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={modal.selectedPortal}
                    disabled={portalDisabled}
                    onClick={(event) => event.stopPropagation()}
                    onChange={togglePortal}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">Parent Portal Fee</p>
                        <p className="mt-1 text-sm opacity-80">Family-level portal access for this parent account.</p>
                      </div>
                      <span
                        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getFeeStatusTone(
                          row.portalPaymentStatus,
                        )}`}
                      >
                        <FeeStatusIcon status={row.portalPaymentStatus} />
                        {paymentStatusLabel(row.portalPaymentStatus)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{formatMoney(portalAmount)}</p>
                  </div>
                </div>
              </button>

              <div className="space-y-3">
                {manageableStudents.map((student) => {
                  const isSelected = modal.selectedStudentIds.includes(student.studentId);
                  const isDisabled = student.paymentStatus === 'paid' || admissionAmountMissing;

                  return (
                    <button
                      key={student.studentId}
                      type="button"
                      onClick={() => toggleStudent(student)}
                      disabled={isDisabled}
                      className={`w-full rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-100'
                          : 'border-slate-200 text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleStudent(student)}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold">Admission Fee - {student.studentName}</p>
                              <p className="mt-1 text-sm opacity-80">{student.studentEmail || 'No student email'}</p>
                              {student.year || student.school ? (
                                <p className="mt-1 text-xs opacity-70">
                                  {[student.year, student.school].filter(Boolean).join(' - ')}
                                </p>
                              ) : null}
                            </div>
                            <span
                              className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getFeeStatusTone(
                                student.paymentStatus,
                              )}`}
                            >
                              <FeeStatusIcon status={student.paymentStatus} />
                              {paymentStatusLabel(student.paymentStatus)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-semibold">{formatMoney(getAdmissionAmount(student))}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Cart</p>
              <div className="mt-3 space-y-2 text-sm">
                {modal.selectedPortal ? (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Parent Portal Fee</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{paymentStatusLabel(row.portalPaymentStatus)}</p>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatMoney(portalAmount)}</p>
                  </div>
                ) : null}
                {selectedStudents.map((student) => (
                  <div key={student.studentId} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Admission Fee</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{student.studentName}</p>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatMoney(getAdmissionAmount(student))}</p>
                  </div>
                ))}
                {selectedCount === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Select at least one fee to continue.</p>
                ) : null}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Estimated total</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(cartTotal)}</p>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{invoicePlan}</p>
                {sendDisabled && modal.mode === 'send' && selectedCount > 0 ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Configure the selected fee amount in Payment Settings before sending.
                  </p>
                ) : null}
                <div className="mt-5 flex flex-col-reverse gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={actionDisabled}
                    className={`rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
                      modal.mode === 'send' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isProcessing
                      ? modal.mode === 'send'
                        ? 'Sending...'
                        : 'Saving...'
                      : modal.mode === 'send'
                        ? 'Finalize & Send Invoice'
                        : 'Mark Selected Paid'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkSendModal({
  admissionFeeAmount,
  bulkAdmissionCount,
  bulkCombinedCount,
  bulkPortalCount,
  onClose,
  onSubmit,
  parentPortalYearlyFeeAmount,
  processingKey,
  selection,
  setSelection,
}: {
  admissionFeeAmount: number;
  bulkAdmissionCount: number;
  bulkCombinedCount: number;
  bulkPortalCount: number;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  parentPortalYearlyFeeAmount: number;
  processingKey: string | null;
  selection: PaymentFeeSelection;
  setSelection: (selection: PaymentFeeSelection) => void;
}) {
  const selectedCount =
    selection === 'portal' ? bulkPortalCount : selection === 'admission' ? bulkAdmissionCount : bulkCombinedCount;
  const amountMissing =
    (selection === 'portal' && parentPortalYearlyFeeAmount <= 0) ||
    (selection === 'admission' && admissionFeeAmount <= 0) ||
    (selection === 'both' && (admissionFeeAmount <= 0 || parentPortalYearlyFeeAmount <= 0));
  const disabled = Boolean(processingKey) || selectedCount === 0 || amountMissing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-blue-600 dark:text-blue-300">Bulk Send</p>
              <h3 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">Send invoices to current filter</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose what to send, then confirm once.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { value: 'portal' as const, title: 'Portal', count: bulkPortalCount },
              { value: 'admission' as const, title: 'Admission', count: bulkAdmissionCount },
              { value: 'both' as const, title: 'Both', count: bulkCombinedCount },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelection(option.value)}
                className={`rounded-xl border p-4 text-left ${
                  selection === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-100'
                    : 'border-slate-200 text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <p className="font-semibold">{option.title}</p>
                <p className="mt-1 text-sm opacity-80">{option.count} invoices</p>
              </button>
            ))}
          </div>
          {amountMissing ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Configure the required fee amount in Payment Settings before sending.
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled}
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {processingKey ? 'Sending...' : `Send ${selectedCount} Invoice${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaginationControls({
  endIndex,
  filteredCount,
  loading,
  onPageChange,
  page,
  pageCount,
  startIndex,
}: {
  endIndex: number;
  filteredCount: number;
  loading?: boolean;
  onPageChange: (value: number) => void;
  page: number;
  pageCount: number;
  startIndex: number;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300 md:flex-row md:items-center md:justify-between">
      <p>{loading ? 'Loading parent payment records...' : `Showing ${startIndex}-${endIndex} of ${filteredCount} parents`}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={loading || page <= 1 || filteredCount === 0}
          className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Previous
        </button>
        <span className="px-2">
          {loading ? 'Loading...' : `Page ${filteredCount === 0 ? 0 : page} of ${filteredCount === 0 ? 0 : pageCount}`}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={loading || page >= pageCount || filteredCount === 0}
          className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function LoadingTableRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index} className="animate-pulse align-top">
          <td className="px-4 py-4">
            <div className="h-4 w-40 rounded bg-slate-200 dark:bg-gray-700" />
            <div className="mt-3 h-3 w-56 rounded bg-slate-100 dark:bg-gray-700/70" />
          </td>
          <td className="min-w-[680px] px-4 py-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-700/40">
              <div className="h-4 w-44 rounded bg-slate-200 dark:bg-gray-600" />
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="h-14 rounded bg-slate-100 dark:bg-gray-700" />
                <div className="h-14 rounded bg-slate-100 dark:bg-gray-700" />
              </div>
            </div>
          </td>
          <td className="w-[180px] px-4 py-4">
            <div className="h-10 w-full rounded-lg bg-slate-200 dark:bg-gray-700" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function PaymentsTab({
  rows,
  filteredCount,
  totalCount,
  searchTerm,
  onSearchTermChange,
  portalStatusFilter,
  onPortalStatusFilterChange,
  admissionStatusFilter,
  onAdmissionStatusFilterChange,
  paymentStatusFilter,
  onPaymentStatusFilterChange,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  startIndex,
  endIndex,
  runBulkBillingAction,
  bulkPortalItems,
  bulkAdmissionItems,
  bulkCombinedItems,
  processingKey,
  admissionFeeAmount,
  parentPortalYearlyFeeAmount,
  settingsLoading,
  managementLoading,
  runBillingAction,
  formatMoney,
  formatDate,
}: PaymentsTabProps) {
  const [actionModal, setActionModal] = useState<PaymentActionModalState | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<PaymentFeeSelection>('both');

  const handleOpenActionModal = (row: BillingPaymentParentRow) => {
    setActionModal(getDefaultActionState(row));
  };

  const handleSubmitActionModal = async () => {
    if (!actionModal) return;

    const selectedStudents = actionModal.row.students.filter((student) =>
      actionModal.selectedStudentIds.includes(student.studentId),
    );

    if (actionModal.mode === 'send') {
      if (actionModal.selectedPortal && selectedStudents.length === 1) {
        const completed = await runBillingAction({
          action: 'send_combined_payment_link',
          feeCode: 'admission_fee',
          parentEmail: actionModal.row.parentEmail,
          studentId: selectedStudents[0].studentId,
          processingId: `send-combined-${selectedStudents[0].studentId}`,
        });
        if (!completed) return;
      } else if (actionModal.selectedPortal && selectedStudents.length === 0) {
        const completed = await runBillingAction({
          action: 'send_payment_link',
          feeCode: 'parent_portal_yearly',
          parentEmail: actionModal.row.parentEmail,
          processingId: `send-parent-${actionModal.row.parentEmail}`,
        });
        if (!completed) return;
      } else if (!actionModal.selectedPortal && selectedStudents.length === 1) {
        const completed = await runBillingAction({
          action: 'send_payment_link',
          feeCode: 'admission_fee',
          parentEmail: actionModal.row.parentEmail,
          studentId: selectedStudents[0].studentId,
          processingId: `send-admission-${selectedStudents[0].studentId}`,
        });
        if (!completed) return;
      } else {
        const items: SelectedBillingItem[] = [
          ...(actionModal.selectedPortal
            ? [
                {
                  parentEmail: actionModal.row.parentEmail,
                  feeCodes: ['parent_portal_yearly'] as FeeCode[],
                },
              ]
            : []),
          ...selectedStudents.map((student) => ({
            parentEmail: actionModal.row.parentEmail,
            studentId: student.studentId,
            feeCodes: ['admission_fee'] as FeeCode[],
          })),
        ];

        const completed = await runBulkBillingAction({
          processingId: `cart-${actionModal.row.parentEmail}`,
          items,
          successLabel: 'selected payment',
        });
        if (!completed) return;
      }
    } else {
      if (actionModal.selectedPortal) {
        const completed = await runBillingAction({
          action: 'mark_paid_offline',
          feeCode: 'parent_portal_yearly',
          parentEmail: actionModal.row.parentEmail,
          processingId: `offline-parent-${actionModal.row.parentEmail}`,
        });
        if (!completed) return;
      }

      for (const student of selectedStudents) {
        const completed = await runBillingAction({
          action: 'mark_paid_offline',
          feeCode: 'admission_fee',
          parentEmail: actionModal.row.parentEmail,
          studentId: student.studentId,
          processingId: `offline-admission-${student.studentId}`,
        });
        if (!completed) return;
      }
    }

    setActionModal(null);
  };

  const handleBulkSubmit = async () => {
    if (bulkSelection === 'portal') {
      await runBulkBillingAction({
        processingId: 'bulk-portal',
        items: bulkPortalItems,
        successLabel: 'unpaid parent portal',
      });
    } else if (bulkSelection === 'admission') {
      await runBulkBillingAction({
        processingId: 'bulk-admission',
        items: bulkAdmissionItems,
        successLabel: 'unpaid admission',
      });
    } else {
      await runBulkBillingAction({
        processingId: 'bulk-combined',
        items: bulkCombinedItems,
        successLabel: 'combined unpaid',
      });
    }

    setShowBulkModal(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-gray-700">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Payments</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review parent portal and student admission fee status together, then send Stripe links or mark payments offline.
          </p>
          <p className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200">
            {managementLoading ? 'Loading parents...' : `Showing ${filteredCount} of ${totalCount} parents`}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_180px_170px_120px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search parent or student"
            disabled={managementLoading}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <select
            value={portalStatusFilter}
            onChange={(event) =>
              onPortalStatusFilterChange(event.target.value as FeePaymentStatusFilter)
            }
            disabled={managementLoading}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All portal statuses</option>
            <option value="paid">Portal paid</option>
            <option value="invoice_sent">Portal invoice sent</option>
            <option value="unpaid">Portal unpaid</option>
          </select>
          <select
            value={admissionStatusFilter}
            onChange={(event) =>
              onAdmissionStatusFilterChange(event.target.value as FeePaymentStatusFilter)
            }
            disabled={managementLoading}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All admission statuses</option>
            <option value="paid">Admission paid</option>
            <option value="invoice_sent">Admission invoice sent</option>
            <option value="unpaid">Admission unpaid</option>
          </select>
          <select
            value={paymentStatusFilter}
            onChange={(event) => onPaymentStatusFilterChange(event.target.value as PaymentStatusFilter)}
            disabled={managementLoading}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All payments</option>
            <option value="any_unpaid">Any unpaid</option>
            <option value="fully_paid">Fully paid</option>
          </select>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            disabled={managementLoading}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            disabled={managementLoading}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Bulk Send Invoices
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose portal, admission, or both in one clear step.
          </p>
        </div>
      </div>

      {settingsLoading ? (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Loading payment settings...
        </div>
      ) : (admissionFeeAmount <= 0 || parentPortalYearlyFeeAmount <= 0) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {admissionFeeAmount <= 0 && parentPortalYearlyFeeAmount <= 0
            ? 'Admission and parent portal yearly fee amounts are not configured. Set them in Payment Settings before sending Stripe links.'
            : admissionFeeAmount <= 0
              ? 'Admission fee amount is not configured. Set it in Payment Settings before sending Stripe links.'
              : 'Parent portal yearly fee amount is not configured. Set it in Payment Settings before sending Stripe links.'}
        </div>
      )}

      <div className="mt-5">
        <PaginationControls
          endIndex={endIndex}
          filteredCount={filteredCount}
          loading={managementLoading}
          onPageChange={onPageChange}
          page={page}
          pageCount={pageCount}
          startIndex={startIndex}
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
        <table className="w-full min-w-[1180px] divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-slate-50/80 dark:bg-gray-800/70">
            <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3.5 font-medium">Parent</th>
              <th className="px-4 py-3.5 font-medium">Students & Fees</th>
              <th className="px-4 py-3.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800">
            {managementLoading ? (
              <LoadingTableRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No parent payment records found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                return (
                  <tr key={row.parentEmail} className="align-top hover:bg-slate-50/60 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{row.parentName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{row.parentEmail}</p>
                        {row.parentPhone ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{row.parentPhone}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="min-w-[680px] px-4 py-4">
                      <div className="space-y-3">
                        {row.students.length > 0 ? (
                          row.students.map((student) => (
                            <StudentFeeStatusBlock
                              key={student.studentId || student.studentEmail}
                              formatDate={formatDate}
                              formatMoney={formatMoney}
                              portalLatestPayment={row.portalLatestPayment}
                              portalOutstandingAmount={row.portalOutstandingAmount}
                              portalOutstandingInvoices={row.portalOutstandingInvoices}
                              portalPaidUntil={row.portalPaidUntil}
                              portalPaymentStatus={row.portalPaymentStatus}
                              student={student}
                            />
                          ))
                        ) : (
                          <ParentPortalOnlyBlock formatDate={formatDate} formatMoney={formatMoney} row={row} />
                        )}
                      </div>
                    </td>
                    <td className="w-[180px] px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleOpenActionModal(row)}
                        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                      >
                        Manage
                      </button>
                      <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        Send portal, admission, both, or mark paid.
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <PaginationControls
          endIndex={endIndex}
          filteredCount={filteredCount}
          loading={managementLoading}
          onPageChange={onPageChange}
          page={page}
          pageCount={pageCount}
          startIndex={startIndex}
        />
      </div>

      {actionModal ? (
        <PaymentActionModal
          admissionFeeAmount={admissionFeeAmount}
          formatMoney={formatMoney}
          modal={actionModal}
          onChange={setActionModal}
          onClose={() => setActionModal(null)}
          onSubmit={handleSubmitActionModal}
          parentPortalYearlyFeeAmount={parentPortalYearlyFeeAmount}
          processingKey={processingKey}
        />
      ) : null}

      {showBulkModal ? (
        <BulkSendModal
          admissionFeeAmount={admissionFeeAmount}
          bulkAdmissionCount={bulkAdmissionItems.length}
          bulkCombinedCount={bulkCombinedItems.length}
          bulkPortalCount={bulkPortalItems.length}
          onClose={() => setShowBulkModal(false)}
          onSubmit={handleBulkSubmit}
          parentPortalYearlyFeeAmount={parentPortalYearlyFeeAmount}
          processingKey={processingKey}
          selection={bulkSelection}
          setSelection={setBulkSelection}
        />
      ) : null}
    </div>
  );
}

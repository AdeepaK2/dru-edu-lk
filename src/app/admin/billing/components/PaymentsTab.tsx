import { useState } from 'react';
import type {
  AdmissionFeeRecord,
  BillingAccount,
  BillingPaymentParentRow,
  BillingPaymentStudent,
  FeePaymentStatus,
  FeePaymentStatusFilter,
  PaymentStatusFilter,
} from '../types';

type FeeCode = 'admission_fee' | 'parent_portal_yearly';
type PaymentActionMode = 'send' | 'offline';
type PaymentFeeSelection = 'portal' | 'admission' | 'both';

interface PaymentActionModalState {
  row: BillingPaymentParentRow;
  mode: PaymentActionMode;
  feeSelection: PaymentFeeSelection;
  studentId: string;
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
  }) => void | Promise<void>;
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
    studentId: string;
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
  }) => void | Promise<void>;
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

function getPaymentStatusPill(status: FeePaymentStatus) {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'invoice_sent':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-amber-100 text-amber-800';
  }
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
  payment: BillingPaymentParentRow['portalLatestPayment'];
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

function AdmissionStatusBlock({
  formatDate,
  formatMoney,
  student,
}: {
  formatDate: (value?: string | null) => string;
  formatMoney: (amount: number, currency?: string) => string;
  student: BillingPaymentStudent;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-700/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{student.studentName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{student.studentEmail || 'No student email'}</p>
          {student.year || student.school ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {[student.year, student.school].filter(Boolean).join(' - ')}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getPaymentStatusPill(
            student.paymentStatus,
          )}`}
        >
          Admission {paymentStatusLabel(student.paymentStatus)}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Outstanding</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
            {formatMoney(student.totalOutstandingAmount)}
          </p>
          <InvoiceList
            emptyLabel={student.canManageAdmission ? 'No unpaid admission invoices' : 'No admission record found'}
            formatDate={formatDate}
            formatMoney={formatMoney}
            invoices={student.outstandingInvoices}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Latest payment</p>
          <div className="mt-1">
            <PaymentSummary
              emptyLabel="No admission payment recorded"
              formatDate={formatDate}
              formatMoney={formatMoney}
              payment={student.latestPayment}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function getManageableStudents(row: BillingPaymentParentRow) {
  return row.students.filter((student) => student.canManageAdmission);
}

function getFirstUnpaidStudent(row: BillingPaymentParentRow) {
  return getManageableStudents(row).find((student) => student.paymentStatus !== 'paid');
}

function getDefaultActionState(row: BillingPaymentParentRow): PaymentActionModalState {
  const firstUnpaidStudent = getFirstUnpaidStudent(row);
  const firstStudent = firstUnpaidStudent || getManageableStudents(row)[0];
  const portalUnpaid = row.portalPaymentStatus !== 'paid';
  const admissionUnpaid = Boolean(firstUnpaidStudent);

  return {
    row,
    mode: 'send',
    feeSelection: portalUnpaid && admissionUnpaid ? 'both' : portalUnpaid ? 'portal' : 'admission',
    studentId: firstStudent?.studentId || '',
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
  const selectedStudent = manageableStudents.find((student) => student.studentId === modal.studentId);
  const isProcessing = Boolean(processingKey);
  const needsAdmission = modal.feeSelection === 'admission' || modal.feeSelection === 'both';
  const needsPortal = modal.feeSelection === 'portal' || modal.feeSelection === 'both';
  const portalPaid = row.portalPaymentStatus === 'paid';
  const admissionPaid = selectedStudent?.paymentStatus === 'paid';
  const sendDisabled =
    (needsPortal && parentPortalYearlyFeeAmount <= 0) ||
    (needsAdmission && admissionFeeAmount <= 0) ||
    (needsAdmission && !selectedStudent) ||
    (needsPortal && portalPaid && !needsAdmission) ||
    (needsAdmission && admissionPaid && !needsPortal) ||
    (modal.feeSelection === 'both' && (portalPaid || admissionPaid)) ||
    (modal.feeSelection === 'both' && portalPaid && admissionPaid);
  const offlineDisabled =
    (needsAdmission && !selectedStudent) ||
    (needsPortal && portalPaid && !needsAdmission) ||
    (needsAdmission && admissionPaid && !needsPortal) ||
    (modal.feeSelection === 'both' && (portalPaid || admissionPaid)) ||
    (modal.feeSelection === 'both' && portalPaid && admissionPaid);
  const actionDisabled = isProcessing || (modal.mode === 'send' ? sendDisabled : offlineDisabled);

  const setMode = (mode: PaymentActionMode) => onChange({ ...modal, mode });
  const setFeeSelection = (feeSelection: PaymentFeeSelection) => onChange({ ...modal, feeSelection });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
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

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Fees</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  value: 'portal' as const,
                  title: 'Portal',
                  body: `Status: ${paymentStatusLabel(row.portalPaymentStatus)}`,
                  disabled: parentPortalYearlyFeeAmount <= 0 && modal.mode === 'send',
                },
                {
                  value: 'admission' as const,
                  title: 'Admission',
                  body: selectedStudent
                    ? `Status: ${paymentStatusLabel(selectedStudent.paymentStatus)}`
                    : 'Select a student',
                  disabled: manageableStudents.length === 0 || (admissionFeeAmount <= 0 && modal.mode === 'send'),
                },
                {
                  value: 'both' as const,
                  title: 'Both',
                  body: 'Portal and admission together',
                  disabled:
                    manageableStudents.length === 0 ||
                    portalPaid ||
                    Boolean(selectedStudent && selectedStudent.paymentStatus === 'paid') ||
                    (modal.mode === 'send' && (admissionFeeAmount <= 0 || parentPortalYearlyFeeAmount <= 0)),
                },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFeeSelection(option.value)}
                  disabled={option.disabled}
                  className={`rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                    modal.feeSelection === option.value
                      ? 'border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-400 dark:bg-violet-900/20 dark:text-violet-100'
                      : 'border-slate-200 text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <p className="font-semibold">{option.title}</p>
                  <p className="mt-1 text-sm opacity-80">{option.body}</p>
                </button>
              ))}
            </div>
          </div>

          {needsAdmission ? (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">Student</span>
              <select
                value={modal.studentId}
                onChange={(event) => onChange({ ...modal, studentId: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select student</option>
                {manageableStudents.map((student) => (
                  <option key={student.studentId} value={student.studentId}>
                    {student.studentName} - {paymentStatusLabel(student.paymentStatus)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Summary</p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {needsPortal ? (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Parent portal</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {paymentStatusLabel(row.portalPaymentStatus)} - {formatMoney(row.portalOutstandingAmount)}
                  </p>
                </div>
              ) : null}
              {needsAdmission && selectedStudent ? (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Admission</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedStudent.studentName} - {formatMoney(selectedStudent.totalOutstandingAmount)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

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
                  ? 'Send'
                  : 'Mark Paid'}
            </button>
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
          <td className="w-[280px] px-4 py-4">
            <div className="h-6 w-32 rounded-full bg-slate-200 dark:bg-gray-700" />
            <div className="mt-5 h-3 w-20 rounded bg-slate-100 dark:bg-gray-700/70" />
            <div className="mt-2 h-4 w-24 rounded bg-slate-200 dark:bg-gray-700" />
          </td>
          <td className="min-w-[420px] px-4 py-4">
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

    const selectedStudent = actionModal.row.students.find((student) => student.studentId === actionModal.studentId);
    const needsPortal = actionModal.feeSelection === 'portal' || actionModal.feeSelection === 'both';
    const needsAdmission = actionModal.feeSelection === 'admission' || actionModal.feeSelection === 'both';

    if (actionModal.mode === 'send') {
      if (actionModal.feeSelection === 'portal') {
        await runBillingAction({
          action: 'send_payment_link',
          feeCode: 'parent_portal_yearly',
          parentEmail: actionModal.row.parentEmail,
          processingId: `send-parent-${actionModal.row.parentEmail}`,
        });
      } else if (actionModal.feeSelection === 'admission' && selectedStudent) {
        await runBillingAction({
          action: 'send_payment_link',
          feeCode: 'admission_fee',
          parentEmail: actionModal.row.parentEmail,
          studentId: selectedStudent.studentId,
          processingId: `send-admission-${selectedStudent.studentId}`,
        });
      } else if (selectedStudent) {
        await runBillingAction({
          action: 'send_combined_payment_link',
          feeCode: 'admission_fee',
          parentEmail: actionModal.row.parentEmail,
          studentId: selectedStudent.studentId,
          processingId: `send-combined-${selectedStudent.studentId}`,
        });
      }
    } else {
      if (needsPortal) {
        await runBillingAction({
          action: 'mark_paid_offline',
          feeCode: 'parent_portal_yearly',
          parentEmail: actionModal.row.parentEmail,
          processingId: `offline-parent-${actionModal.row.parentEmail}`,
        });
      }

      if (needsAdmission && selectedStudent) {
        await runBillingAction({
          action: 'mark_paid_offline',
          feeCode: 'admission_fee',
          parentEmail: actionModal.row.parentEmail,
          studentId: selectedStudent.studentId,
          processingId: `offline-admission-${selectedStudent.studentId}`,
        });
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
        <table className="w-full min-w-[1280px] divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-slate-50/80 dark:bg-gray-800/70">
            <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3.5 font-medium">Parent</th>
              <th className="px-4 py-3.5 font-medium">Portal Fee</th>
              <th className="px-4 py-3.5 font-medium">Admission Fees</th>
              <th className="px-4 py-3.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800">
            {managementLoading ? (
              <LoadingTableRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
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
                    <td className="w-[280px] px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPaymentStatusPill(
                          row.portalPaymentStatus,
                        )}`}
                      >
                        Parent portal {paymentStatusLabel(row.portalPaymentStatus)}
                      </span>
                      <p className="mt-3 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        Paid until
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{formatDate(row.portalPaidUntil)}</p>
                      <p className="mt-3 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        Outstanding
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatMoney(row.portalOutstandingAmount)}
                      </p>
                      <InvoiceList
                        emptyLabel="No unpaid portal invoices"
                        formatDate={formatDate}
                        formatMoney={formatMoney}
                        invoices={row.portalOutstandingInvoices}
                      />
                      <p className="mt-3 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        Latest payment
                      </p>
                      <div className="mt-1">
                        <PaymentSummary
                          emptyLabel="No portal payment recorded"
                          formatDate={formatDate}
                          formatMoney={formatMoney}
                          payment={row.portalLatestPayment}
                        />
                      </div>
                    </td>
                    <td className="min-w-[420px] px-4 py-4">
                      <div className="space-y-3">
                        {row.students.length > 0 ? (
                          row.students.map((student) => (
                            <AdmissionStatusBlock
                              key={student.studentId || student.studentEmail}
                              formatDate={formatDate}
                              formatMoney={formatMoney}
                              student={student}
                            />
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No linked students found</p>
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

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
  onRefresh: () => void | Promise<void>;
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
  onRefresh,
  runBulkBillingAction,
  bulkPortalItems,
  bulkAdmissionItems,
  bulkCombinedItems,
  processingKey,
  admissionFeeAmount,
  parentPortalYearlyFeeAmount,
  managementLoading,
  runBillingAction,
  formatMoney,
  formatDate,
}: PaymentsTabProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-gray-700">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Payments</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review parent portal and student admission fee status together, then send Stripe links or mark payments offline.
          </p>
          <p className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200">
            Showing {filteredCount} of {totalCount} parents
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_180px_170px_120px_auto]">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search parent or student"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <select
            value={portalStatusFilter}
            onChange={(event) =>
              onPortalStatusFilterChange(event.target.value as FeePaymentStatusFilter)
            }
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
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All payments</option>
            <option value="any_unpaid">Any unpaid</option>
            <option value="fully_paid">Fully paid</option>
          </select>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              runBulkBillingAction({
                processingId: 'bulk-portal',
                items: bulkPortalItems,
                successLabel: 'unpaid parent portal',
              })
            }
            disabled={processingKey === 'bulk-portal' || parentPortalYearlyFeeAmount <= 0}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {processingKey === 'bulk-portal' ? 'Sending...' : 'Send Unpaid Portal Links'}
          </button>
          <button
            type="button"
            onClick={() =>
              runBulkBillingAction({
                processingId: 'bulk-admission',
                items: bulkAdmissionItems,
                successLabel: 'unpaid admission',
              })
            }
            disabled={processingKey === 'bulk-admission' || admissionFeeAmount <= 0}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {processingKey === 'bulk-admission' ? 'Sending...' : 'Send Unpaid Admission Links'}
          </button>
          <button
            type="button"
            onClick={() =>
              runBulkBillingAction({
                processingId: 'bulk-combined',
                items: bulkCombinedItems,
                successLabel: 'combined unpaid',
              })
            }
            disabled={
              processingKey === 'bulk-combined' ||
              admissionFeeAmount <= 0 ||
              parentPortalYearlyFeeAmount <= 0
            }
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {processingKey === 'bulk-combined' ? 'Sending...' : 'Send Combined Invoices'}
          </button>
        </div>
      </div>

      {(admissionFeeAmount <= 0 || parentPortalYearlyFeeAmount <= 0) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {admissionFeeAmount <= 0 && parentPortalYearlyFeeAmount <= 0
            ? 'Admission and parent portal yearly fee amounts are not configured. Set them in Payment Settings before sending Stripe links.'
            : admissionFeeAmount <= 0
              ? 'Admission fee amount is not configured. Set it in Payment Settings before sending Stripe links.'
              : 'Parent portal yearly fee amount is not configured. Set it in Payment Settings before sending Stripe links.'}
        </div>
      )}

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
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading payment data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No parent payment records found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isPortalPaid = row.portalPaymentStatus === 'paid';

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
                    <td className="w-[280px] px-4 py-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            Parent portal
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              runBillingAction({
                                action: 'send_payment_link',
                                feeCode: 'parent_portal_yearly',
                                parentEmail: row.parentEmail,
                                processingId: `send-parent-${row.parentEmail}`,
                              })
                            }
                            disabled={
                              isPortalPaid ||
                              processingKey === `send-parent-${row.parentEmail}` ||
                              parentPortalYearlyFeeAmount <= 0
                            }
                            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {isPortalPaid
                              ? 'Already Active'
                              : processingKey === `send-parent-${row.parentEmail}`
                                ? 'Sending...'
                                : 'Send Portal Link'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              runBillingAction({
                                action: 'mark_paid_offline',
                                feeCode: 'parent_portal_yearly',
                                parentEmail: row.parentEmail,
                                processingId: `offline-parent-${row.parentEmail}`,
                              })
                            }
                            disabled={isPortalPaid || processingKey === `offline-parent-${row.parentEmail}`}
                            className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            {isPortalPaid
                              ? 'Paid'
                              : processingKey === `offline-parent-${row.parentEmail}`
                                ? 'Saving...'
                                : 'Mark Portal Paid'}
                          </button>
                        </div>

                        {row.students.map((student) => {
                          const isAdmissionPaid = student.paymentStatus === 'paid';
                          const admissionProcessingId = `send-admission-${student.studentId}`;
                          const combinedProcessingId = `send-combined-${student.studentId}`;
                          const offlineProcessingId = `offline-admission-${student.studentId}`;
                          const admissionActionsDisabled = !student.canManageAdmission;

                          return (
                            <div
                              key={`${student.studentId || student.studentEmail}-actions`}
                              className="space-y-2 border-t border-slate-200 pt-4 dark:border-gray-700"
                            >
                              <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                {student.studentName}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  runBillingAction({
                                    action: 'send_payment_link',
                                    feeCode: 'admission_fee',
                                    parentEmail: row.parentEmail,
                                    studentId: student.studentId,
                                    processingId: admissionProcessingId,
                                  })
                                }
                                disabled={
                                  admissionActionsDisabled ||
                                  isAdmissionPaid ||
                                  processingKey === admissionProcessingId ||
                                  admissionFeeAmount <= 0
                                }
                                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                {isAdmissionPaid
                                  ? 'Admission Paid'
                                  : processingKey === admissionProcessingId
                                    ? 'Sending...'
                                    : 'Send Admission Link'}
                              </button>
                              {!isAdmissionPaid && !isPortalPaid ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runBillingAction({
                                      action: 'send_combined_payment_link',
                                      feeCode: 'admission_fee',
                                      parentEmail: row.parentEmail,
                                      studentId: student.studentId,
                                      processingId: combinedProcessingId,
                                    })
                                  }
                                  disabled={
                                    admissionActionsDisabled ||
                                    processingKey === combinedProcessingId ||
                                    admissionFeeAmount <= 0 ||
                                    parentPortalYearlyFeeAmount <= 0
                                  }
                                  className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                                >
                                  {processingKey === combinedProcessingId ? 'Sending...' : 'Send Combined'}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  runBillingAction({
                                    action: 'mark_paid_offline',
                                    feeCode: 'admission_fee',
                                    parentEmail: row.parentEmail,
                                    studentId: student.studentId,
                                    processingId: offlineProcessingId,
                                  })
                                }
                                disabled={
                                  admissionActionsDisabled ||
                                  isAdmissionPaid ||
                                  processingKey === offlineProcessingId
                                }
                                className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                {isAdmissionPaid
                                  ? 'Paid'
                                  : processingKey === offlineProcessingId
                                    ? 'Saving...'
                                    : 'Mark Admission Paid'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300 md:flex-row md:items-center md:justify-between">
        <p>
          Showing {startIndex}-{endIndex} of {filteredCount} parents
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || filteredCount === 0}
            className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Previous
          </button>
          <span className="px-2">
            Page {filteredCount === 0 ? 0 : page} of {filteredCount === 0 ? 0 : pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount || filteredCount === 0}
            className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

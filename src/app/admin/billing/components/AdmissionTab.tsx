import { AdmissionFeeRecord, BillingAccount } from '../types';

interface AdmissionTabProps {
  filteredAdmissionFees: AdmissionFeeRecord[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  admissionStatusFilter: 'all' | AdmissionFeeRecord['admissionStatus'];
  onAdmissionStatusFilterChange: (value: 'all' | AdmissionFeeRecord['admissionStatus']) => void;
  onRefresh: () => void | Promise<void>;
  runBulkBillingAction: (args: {
    processingId: string;
    items: Array<{
      parentEmail: string;
      studentId?: string;
      feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
    }>;
    successLabel: string;
  }) => void | Promise<void>;
  bulkAdmissionItems: Array<{
    parentEmail: string;
    studentId: string;
    feeCodes: Array<'admission_fee'>;
  }>;
  bulkCombinedItems: Array<{
    parentEmail: string;
    studentId: string;
    feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
  }>;
  processingKey: string | null;
  admissionFeeAmount: number;
  parentPortalYearlyFeeAmount: number;
  managementLoading: boolean;
  runBillingAction: (args: {
    action: 'mark_paid_offline' | 'send_payment_link' | 'send_combined_payment_link';
    feeCode: 'admission_fee' | 'parent_portal_yearly';
    parentEmail: string;
    studentId?: string;
    processingId: string;
  }) => void | Promise<void>;
  formatMoney: (amount: number, currency?: string) => string;
  formatDate: (value?: string | null) => string;
  getAdmissionStatusPill: (status: AdmissionFeeRecord['admissionStatus']) => string;
  accountByParentEmail: Map<string, BillingAccount>;
}

export function AdmissionTab({
  filteredAdmissionFees,
  searchTerm,
  onSearchTermChange,
  admissionStatusFilter,
  onAdmissionStatusFilterChange,
  onRefresh,
  runBulkBillingAction,
  bulkAdmissionItems,
  bulkCombinedItems,
  processingKey,
  admissionFeeAmount,
  parentPortalYearlyFeeAmount,
  managementLoading,
  runBillingAction,
  formatMoney,
  formatDate,
  getAdmissionStatusPill,
  accountByParentEmail,
}: AdmissionTabProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-gray-700">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Admission Fees</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track admission fee status per student and handle Stripe or offline payment separately from the parent portal fee.
          </p>
          <p className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200">
            Showing {filteredAdmissionFees.length} students
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_200px_auto_auto_auto]">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search student or parent"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <select
            value={admissionStatusFilter}
            onChange={(event) =>
              onAdmissionStatusFilterChange(event.target.value as 'all' | AdmissionFeeRecord['admissionStatus'])
            }
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="payment_required">Payment required</option>
            <option value="none">No record</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Refresh
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
            className="whitespace-nowrap rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {processingKey === 'bulk-admission' ? 'Sending...' : 'Send Admission Links'}
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
            className="whitespace-nowrap rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {processingKey === 'bulk-combined' ? 'Sending...' : 'Send Combined Invoices'}
          </button>
        </div>
      </div>

      {admissionFeeAmount <= 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Admission fee amount is not configured. Set it in the Payment Settings tab before sending Stripe links.
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
        <table className="min-w-[980px] w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-slate-50/80 dark:bg-gray-800/70">
            <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3.5 font-medium">Student</th>
              <th className="px-4 py-3.5 font-medium">Parent</th>
              <th className="px-4 py-3.5 font-medium">Admission Status</th>
              <th className="px-4 py-3.5 font-medium">Outstanding Admission Fee</th>
              <th className="px-4 py-3.5 font-medium">Latest Admission Payment</th>
              <th className="px-4 py-3.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800">
            {managementLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading admission fee data...
                </td>
              </tr>
            ) : filteredAdmissionFees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No admission fee records found.
                </td>
              </tr>
            ) : (
              filteredAdmissionFees.map((record) => (
                <tr key={record.studentId} className="align-top hover:bg-slate-50/60 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{record.studentName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{record.studentEmail}</p>
                      {record.year || record.school ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {[record.year, record.school].filter(Boolean).join(' • ')}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{record.parentName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{record.parentEmail}</p>
                      {record.parentPhone ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{record.parentPhone}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getAdmissionStatusPill(
                        record.admissionStatus,
                      )}`}
                    >
                      {record.admissionStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900 dark:text-white">{formatMoney(record.totalOutstandingAmount)}</p>
                    {record.outstandingInvoices.length > 0 ? (
                      <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                        {record.outstandingInvoices.map((invoice) => (
                          <p key={invoice.invoiceId}>
                            {invoice.invoiceNumber} • {formatMoney(invoice.amountTotal, invoice.currency)} • due {formatDate(invoice.dueAt)}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No unpaid admission fee invoices</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                    {record.latestPayment ? (
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{record.latestPayment.invoiceNumber}</p>
                        <p>{formatMoney(record.latestPayment.amount)}</p>
                        <p className="capitalize text-gray-500 dark:text-gray-400">
                          {record.latestPayment.provider} • {formatDate(record.latestPayment.paidAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No admission fee payment recorded</p>
                    )}
                  </td>
                  <td className="px-4 py-4 min-w-[190px]">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          runBillingAction({
                            action: 'send_payment_link',
                            feeCode: 'admission_fee',
                            parentEmail: record.parentEmail,
                            studentId: record.studentId,
                            processingId: `send-admission-${record.studentId}`,
                          })
                        }
                        disabled={processingKey === `send-admission-${record.studentId}` || admissionFeeAmount <= 0}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {processingKey === `send-admission-${record.studentId}` ? 'Sending...' : 'Send Link'}
                      </button>
                      {accountByParentEmail.get(record.parentEmail)?.portalStatus !== 'active' ? (
                        <button
                          type="button"
                          onClick={() =>
                            runBillingAction({
                              action: 'send_combined_payment_link',
                              feeCode: 'admission_fee',
                              parentEmail: record.parentEmail,
                              studentId: record.studentId,
                              processingId: `send-combined-${record.studentId}`,
                            })
                          }
                          disabled={
                            processingKey === `send-combined-${record.studentId}` ||
                            admissionFeeAmount <= 0 ||
                            parentPortalYearlyFeeAmount <= 0
                          }
                          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                        >
                          {processingKey === `send-combined-${record.studentId}` ? 'Sending...' : 'Send Combined'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          runBillingAction({
                            action: 'mark_paid_offline',
                            feeCode: 'admission_fee',
                            parentEmail: record.parentEmail,
                            studentId: record.studentId,
                            processingId: `offline-admission-${record.studentId}`,
                          })
                        }
                        disabled={processingKey === `offline-admission-${record.studentId}`}
                        className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {processingKey === `offline-admission-${record.studentId}` ? 'Saving...' : 'Mark Paid Offline'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

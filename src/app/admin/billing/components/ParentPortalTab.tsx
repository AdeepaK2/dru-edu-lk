import { BillingAccount } from '../types';

interface ParentPortalTabProps {
  filteredAccounts: BillingAccount[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  portalStatusFilter: 'all' | BillingAccount['portalStatus'];
  onPortalStatusFilterChange: (value: 'all' | BillingAccount['portalStatus']) => void;
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
  bulkPortalItems: Array<{
    parentEmail: string;
    feeCodes: Array<'parent_portal_yearly'>;
  }>;
  processingKey: string | null;
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
  getPortalStatusPill: (status: BillingAccount['portalStatus']) => string;
}

export function ParentPortalTab({
  filteredAccounts,
  searchTerm,
  onSearchTermChange,
  portalStatusFilter,
  onPortalStatusFilterChange,
  onRefresh,
  runBulkBillingAction,
  bulkPortalItems,
  processingKey,
  parentPortalYearlyFeeAmount,
  managementLoading,
  runBillingAction,
  formatMoney,
  formatDate,
  getPortalStatusPill,
}: ParentPortalTabProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-gray-700">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Parent Portal Fees</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Send Stripe payment links or mark yearly parent portal fees paid offline for existing parent accounts.
          </p>
          <p className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200">
            Showing {filteredAccounts.length} parent accounts
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_auto_auto]">
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
              onPortalStatusFilterChange(event.target.value as 'all' | BillingAccount['portalStatus'])
            }
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="payment_required">Payment required</option>
            <option value="expired">Expired</option>
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
                processingId: 'bulk-portal',
                items: bulkPortalItems,
                successLabel: 'unpaid parent portal',
              })
            }
            disabled={processingKey === 'bulk-portal' || parentPortalYearlyFeeAmount <= 0}
            className="whitespace-nowrap rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {processingKey === 'bulk-portal' ? 'Sending...' : 'Send Unpaid Portal Links'}
          </button>
        </div>
      </div>

      {parentPortalYearlyFeeAmount <= 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Parent portal yearly fee amount is not configured. Set it in the Payment Settings tab before sending Stripe links.
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
        <table className="min-w-[1100px] w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-slate-50/80 dark:bg-gray-800/70">
            <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3.5 font-medium">Parent</th>
              <th className="px-4 py-3.5 font-medium">Students</th>
              <th className="px-4 py-3.5 font-medium">Portal Status</th>
              <th className="px-4 py-3.5 font-medium">Paid Until</th>
              <th className="px-4 py-3.5 font-medium">Outstanding Portal Fee</th>
              <th className="px-4 py-3.5 font-medium">Latest Portal Payment</th>
              <th className="px-4 py-3.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800">
            {managementLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading parent portal fee data...
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No parent portal accounts found.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => (
                <tr key={account.parentEmail} className="align-top hover:bg-slate-50/60 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{account.parentName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{account.parentEmail}</p>
                      {account.parentPhone ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{account.parentPhone}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {account.students.length > 0 ? (
                        account.students.map((student) => (
                          <div key={student.studentId} className="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-gray-700/50">
                            <p className="font-medium text-gray-900 dark:text-white">{student.studentName}</p>
                            <p className="text-gray-500 dark:text-gray-400">{student.studentEmail}</p>
                            {student.year || student.school ? (
                              <p className="text-gray-500 dark:text-gray-400">
                                {[student.year, student.school].filter(Boolean).join(' • ')}
                              </p>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No linked students found</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getPortalStatusPill(
                        account.portalStatus,
                      )}`}
                    >
                      {account.portalStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{formatDate(account.portalPaidUntil)}</td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900 dark:text-white">{formatMoney(account.totalOutstandingAmount)}</p>
                    {account.outstandingInvoices.length > 0 ? (
                      <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                        {account.outstandingInvoices.map((invoice) => (
                          <p key={invoice.invoiceId}>
                            {invoice.invoiceNumber} • {formatMoney(invoice.amountTotal, invoice.currency)} • due {formatDate(invoice.dueAt)}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No unpaid portal fee invoices</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                    {account.latestPayment ? (
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{account.latestPayment.invoiceNumber}</p>
                        <p>{formatMoney(account.latestPayment.amount)}</p>
                        <p className="capitalize text-gray-500 dark:text-gray-400">
                          {account.latestPayment.provider} • {formatDate(account.latestPayment.paidAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No portal fee payment recorded</p>
                    )}
                  </td>
                  <td className="px-4 py-4 min-w-[190px]">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          runBillingAction({
                            action: 'send_payment_link',
                            feeCode: 'parent_portal_yearly',
                            parentEmail: account.parentEmail,
                            processingId: `send-parent-${account.parentEmail}`,
                          })
                        }
                        disabled={processingKey === `send-parent-${account.parentEmail}` || parentPortalYearlyFeeAmount <= 0}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {processingKey === `send-parent-${account.parentEmail}` ? 'Sending...' : 'Send Link'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runBillingAction({
                            action: 'mark_paid_offline',
                            feeCode: 'parent_portal_yearly',
                            parentEmail: account.parentEmail,
                            processingId: `offline-parent-${account.parentEmail}`,
                          })
                        }
                        disabled={processingKey === `offline-parent-${account.parentEmail}`}
                        className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {processingKey === `offline-parent-${account.parentEmail}` ? 'Saving...' : 'Mark Paid Offline'}
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

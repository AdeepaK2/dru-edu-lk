import { BillingSummary } from '../types';

interface BillingSummaryCardsProps {
  summary: BillingSummary;
}

export function BillingSummaryCards({ summary }: BillingSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {[
        { label: 'Parents', value: summary.totalParents, tone: 'slate' },
        { label: 'Portal Active', value: summary.activeParents, tone: 'green' },
        { label: 'Portal Locked', value: summary.lockedParents, tone: 'amber' },
        { label: 'Pending Invoices', value: summary.pendingInvoices, tone: 'red' },
        { label: 'Admission Paid', value: summary.admissionPaidStudents, tone: 'green' },
        { label: 'Admission Pending', value: summary.admissionPendingStudents, tone: 'amber' },
      ].map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border p-4 shadow-sm transition-colors dark:bg-gray-800 ${
            item.tone === 'green'
              ? 'border-green-200/80 bg-green-50/50 dark:border-green-900/60'
              : item.tone === 'amber'
                ? 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/60'
                : item.tone === 'red'
                  ? 'border-red-200/80 bg-red-50/50 dark:border-red-900/60'
                  : 'border-slate-200/80 bg-white dark:border-gray-700'
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className="mt-2 text-3xl font-semibold leading-none text-gray-900 dark:text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

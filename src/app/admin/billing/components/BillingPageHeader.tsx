export function BillingPageHeader() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-800">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
            Admin Billing
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">Payment Management</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            Manage parent portal fees, admission fees, discounts, offline payments, and Stripe payment links from one place.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 dark:border-blue-900/70 dark:bg-blue-900/20 dark:text-blue-300">
          Melbourne time billing operations
        </div>
      </div>
    </div>
  );
}

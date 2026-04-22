import { Dispatch, FormEvent, SetStateAction } from 'react';
import { AdmissionFeeRecord, BillingAccount, BillingDiscountRecord, DiscountFormState } from '../types';

interface DiscountsTabProps {
  discountForm: DiscountFormState;
  setDiscountForm: Dispatch<SetStateAction<DiscountFormState>>;
  onSaveDiscount: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  discountSaving: boolean;
  accounts: BillingAccount[];
  selectedParentStudents: AdmissionFeeRecord[];
  filteredDiscounts: BillingDiscountRecord[];
  onRefreshDiscounts: () => void | Promise<void>;
  onToggleDiscount: (discountId: string, isActive: boolean) => void | Promise<void>;
  processingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
}

export function DiscountsTab({
  discountForm,
  setDiscountForm,
  onSaveDiscount,
  discountSaving,
  accounts,
  selectedParentStudents,
  filteredDiscounts,
  onRefreshDiscounts,
  onToggleDiscount,
  processingKey,
  formatMoney,
}: DiscountsTabProps) {
  return (
    <div className="space-y-6">
      <form
        onSubmit={onSaveDiscount}
        className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Discounts</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create parent-level discounts for multiple students in one family, or student-specific discounts for financial difficulty cases.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Discount Name</span>
            <input
              type="text"
              value={discountForm.name}
              onChange={(event) => setDiscountForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Sibling support discount"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Discount Scope</span>
            <select
              value={discountForm.scope}
              onChange={(event) =>
                setDiscountForm((current) => ({
                  ...current,
                  scope: event.target.value as 'parent' | 'student',
                  studentId: event.target.value === 'student' ? current.studentId : '',
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="parent">Parent / family discount</option>
              <option value="student">Specific student discount</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Discount Type</span>
            <select
              value={discountForm.type}
              onChange={(event) =>
                setDiscountForm((current) => ({
                  ...current,
                  type: event.target.value as 'percentage' | 'fixed',
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount (AUD)</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Value {discountForm.type === 'percentage' ? '(%)' : '(AUD)'}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discountForm.value}
              onChange={(event) =>
                setDiscountForm((current) => ({
                  ...current,
                  value: Number(event.target.value),
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Parent Account</span>
            <select
              value={discountForm.parentEmail}
              onChange={(event) =>
                setDiscountForm((current) => ({
                  ...current,
                  parentEmail: event.target.value,
                  studentId: '',
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select parent</option>
              {accounts.map((account) => (
                <option key={account.parentEmail} value={account.parentEmail}>
                  {account.parentName} - {account.parentEmail}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Student</span>
            <select
              value={discountForm.studentId}
              onChange={(event) =>
                setDiscountForm((current) => ({
                  ...current,
                  studentId: event.target.value,
                }))
              }
              disabled={discountForm.scope !== 'student' || !discountForm.parentEmail}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select student</option>
              {selectedParentStudents.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.studentName} - {student.studentEmail}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Apply Discount To</span>
            <div className="flex flex-wrap gap-3">
              {[
                { code: 'admission_fee', label: 'Admission Fee' },
                { code: 'parent_portal_yearly', label: 'Parent Portal Fee' },
              ].map((fee) => (
                <label key={fee.code} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={discountForm.feeCodes.includes(fee.code as 'admission_fee' | 'parent_portal_yearly')}
                    onChange={(event) =>
                      setDiscountForm((current) => ({
                        ...current,
                        feeCodes: event.target.checked
                          ? [...current.feeCodes, fee.code as 'admission_fee' | 'parent_portal_yearly']
                          : current.feeCodes.filter((code) => code !== fee.code),
                      }))
                    }
                  />
                  {fee.label}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Reason / Notes</span>
            <textarea
              value={discountForm.reason}
              onChange={(event) => setDiscountForm((current) => ({ ...current, reason: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Financial difficulty, sibling support, retention support..."
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={discountSaving}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {discountSaving ? 'Saving...' : 'Save Discount'}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active and Saved Discounts</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Parent discounts apply to all linked students in that family. Student discounts apply only to the selected student.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshDiscounts}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                <th className="py-3 pr-4 font-medium">Discount</th>
                <th className="py-3 pr-4 font-medium">Target</th>
                <th className="py-3 pr-4 font-medium">Applies To</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredDiscounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No billing discounts found.
                  </td>
                </tr>
              ) : (
                filteredDiscounts.map((discount) => (
                  <tr key={discount.id} className="align-top">
                    <td className="py-4 pr-4">
                      <p className="font-medium text-gray-900 dark:text-white">{discount.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {discount.type === 'percentage' ? `${discount.value}%` : formatMoney(discount.value)}
                      </p>
                      {discount.reason ? (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{discount.reason}</p>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-700 dark:text-gray-300">
                      <p>
                        {discount.parentName || 'Parent'} - {discount.parentEmail}
                      </p>
                      {discount.scope === 'student' ? (
                        <p className="mt-1 text-gray-500 dark:text-gray-400">
                          Student: {discount.studentName || discount.studentId}
                        </p>
                      ) : (
                        <p className="mt-1 text-gray-500 dark:text-gray-400">Family-wide discount</p>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-700 dark:text-gray-300">
                      {discount.feeCodes
                        .map((feeCode) => (feeCode === 'admission_fee' ? 'Admission Fee' : 'Parent Portal Fee'))
                        .join(', ')}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          discount.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {discount.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => onToggleDiscount(discount.id, !discount.isActive)}
                        disabled={processingKey === `discount-${discount.id}`}
                        className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {processingKey === `discount-${discount.id}`
                          ? 'Saving...'
                          : discount.isActive
                            ? 'Disable'
                            : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

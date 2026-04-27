import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from 'react';
import { AdmissionFeeRecord, BillingAccount, BillingDiscountRecord, DiscountFormState } from '../types';

type FeeCode = 'admission_fee' | 'parent_portal_yearly';

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
  runBillingAction: (args: {
    action: 'mark_paid_offline' | 'send_payment_link' | 'send_combined_payment_link';
    feeCode: FeeCode;
    parentEmail: string;
    studentId?: string;
    discountIds?: string[];
    couponCode?: string;
    processingId: string;
  }) => void | Promise<void>;
  processingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
}

const FEE_OPTIONS: Array<{ code: FeeCode; label: string }> = [
  { code: 'admission_fee', label: 'Admission Fee' },
  { code: 'parent_portal_yearly', label: 'Parent Portal Fee' },
];

function formatDiscountValue(discount: Pick<BillingDiscountRecord, 'type' | 'value'>, formatMoney: DiscountsTabProps['formatMoney']) {
  return discount.type === 'percentage' ? `${discount.value}%` : formatMoney(discount.value);
}

function feeLabel(feeCode: FeeCode) {
  return feeCode === 'admission_fee' ? 'Admission Fee' : 'Parent Portal Fee';
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
  runBillingAction,
  processingKey,
  formatMoney,
}: DiscountsTabProps) {
  const [copiedCode, setCopiedCode] = useState('');
  const selectedParent = useMemo(
    () => accounts.find((account) => account.parentEmail === discountForm.parentEmail),
    [accounts, discountForm.parentEmail],
  );

  const selectWorkflow = (scope: DiscountFormState['scope']) => {
    setDiscountForm((current) => ({
      ...current,
      scope,
      name:
        scope === 'coupon'
          ? current.name || 'Reusable coupon'
          : scope === 'student'
            ? current.name || 'Additional student discount'
            : current.name || 'Family discount',
      parentEmail: scope === 'coupon' ? '' : current.parentEmail,
      studentId: scope === 'student' ? current.studentId : '',
      couponCode: scope === 'coupon' ? current.couponCode : '',
      feeCodes: scope === 'coupon' ? current.feeCodes : ['admission_fee'],
    }));
  };

  const copyCoupon = async (code?: string) => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSaveDiscount}
        className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Discounts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create sibling discounts for extra students, family discounts for a parent, or reusable coupon codes parents can enter on the payment page.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { scope: 'student' as const, title: 'Additional Student', body: 'Best for 2nd, 3rd, or later students in one family.' },
              { scope: 'parent' as const, title: 'Family Discount', body: 'Applies to a selected parent account.' },
              { scope: 'coupon' as const, title: 'Coupon Code', body: 'Reusable code that can be copied and used without email matching.' },
            ].map((option) => (
              <button
                key={option.scope}
                type="button"
                onClick={() => selectWorkflow(option.scope)}
                className={`rounded-xl border p-4 text-left transition ${
                  discountForm.scope === option.scope
                    ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-100'
                    : 'border-slate-200 bg-white text-gray-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <p className="font-semibold">{option.title}</p>
                <p className="mt-1 text-sm opacity-80">{option.body}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Name</span>
                <input
                  type="text"
                  value={discountForm.name}
                  onChange={(event) => setDiscountForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder={discountForm.scope === 'coupon' ? 'April coupon' : 'Additional student discount'}
                />
              </label>

              {discountForm.scope === 'coupon' ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Coupon Code</span>
                  <input
                    type="text"
                    value={discountForm.couponCode}
                    onChange={(event) =>
                      setDiscountForm((current) => ({
                        ...current,
                        couponCode: event.target.value.toUpperCase().replace(/\s+/g, ''),
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 font-semibold uppercase tracking-wide dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="SIBLING25"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Parent</span>
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
              )}
            </div>

            {discountForm.scope === 'student' ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Additional Student
                </span>
                <select
                  value={discountForm.studentId}
                  onChange={(event) => setDiscountForm((current) => ({ ...current, studentId: event.target.value }))}
                  disabled={!discountForm.parentEmail}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select the 2nd/additional student</option>
                  {selectedParentStudents.map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.studentName} - {student.studentEmail}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
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
                  Amount {discountForm.type === 'percentage' ? '(%)' : '(AUD)'}
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
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Applies To</span>
              <div className="flex flex-wrap gap-3">
                {FEE_OPTIONS.map((fee) => (
                  <label
                    key={fee.code}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    <input
                      type="checkbox"
                      checked={discountForm.feeCodes.includes(fee.code)}
                      onChange={(event) =>
                        setDiscountForm((current) => ({
                          ...current,
                          feeCodes: event.target.checked
                            ? [...current.feeCodes, fee.code]
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
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Notes</span>
              <textarea
                value={discountForm.reason}
                onChange={(event) => setDiscountForm((current) => ({ ...current, reason: event.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Sibling discount, campaign coupon, financial support..."
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-gray-700 dark:bg-gray-700/40">
            <p className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-300">Preview</p>
            <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
              {discountForm.value > 0
                ? discountForm.type === 'percentage'
                  ? `${discountForm.value}% off`
                  : `${formatMoney(discountForm.value)} off`
                : 'No amount set'}
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {discountForm.scope === 'coupon'
                ? `Coupon ${discountForm.couponCode || 'CODE'} can be used by any parent on an unpaid invoice.`
                : discountForm.scope === 'student'
                  ? `This will attach to ${selectedParent?.parentName || 'the selected parent'} and one selected student.`
                  : `This will attach to ${selectedParent?.parentName || 'the selected parent'} as a family discount.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {discountForm.feeCodes.map((code) => (
                <span key={code} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-gray-800 dark:text-gray-200">
                  {feeLabel(code)}
                </span>
              ))}
            </div>
            <button
              type="submit"
              disabled={discountSaving}
              className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {discountSaving ? 'Saving...' : discountForm.scope === 'coupon' ? 'Save Coupon' : 'Save Discount'}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Saved Discounts and Coupons</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Send an invoice with a selected discount attached, or copy coupon codes for parents to enter on the payment page.
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

        <div className="mt-6 grid gap-4">
          {filteredDiscounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No billing discounts found.
            </div>
          ) : (
            filteredDiscounts.map((discount) => {
              const isCoupon = discount.scope === 'coupon';
              const canSendPortal = !isCoupon && !!discount.parentEmail && discount.feeCodes.includes('parent_portal_yearly');
              const canSendAdmission =
                discount.scope === 'student' && !!discount.parentEmail && !!discount.studentId && discount.feeCodes.includes('admission_fee');
              const canSendCombined =
                discount.scope === 'student' &&
                !!discount.parentEmail &&
                !!discount.studentId &&
                discount.feeCodes.includes('admission_fee') &&
                discount.feeCodes.includes('parent_portal_yearly');

              return (
                <div
                  key={discount.id}
                  className="grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-gray-700 lg:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{discount.name}</p>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                        {formatDiscountValue(discount, formatMoney)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          discount.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {discount.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      {isCoupon
                        ? `Coupon code: ${discount.couponCode || '-'}`
                        : `${discount.parentName || 'Parent'} - ${discount.parentEmail || ''}`}
                    </p>
                    {discount.scope === 'student' ? (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Additional student: {discount.studentName || discount.studentId}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Applies to {discount.feeCodes.map(feeLabel).join(', ')}
                    </p>
                    {discount.reason ? (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{discount.reason}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                    {isCoupon ? (
                      <button
                        type="button"
                        onClick={() => copyCoupon(discount.couponCode)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        {copiedCode === discount.couponCode ? 'Copied' : 'Copy Code'}
                      </button>
                    ) : null}
                    {canSendPortal ? (
                      <button
                        type="button"
                        onClick={() =>
                          runBillingAction({
                            action: 'send_payment_link',
                            feeCode: 'parent_portal_yearly',
                            parentEmail: discount.parentEmail || '',
                            discountIds: [discount.id],
                            processingId: `discount-send-portal-${discount.id}`,
                          })
                        }
                        disabled={processingKey === `discount-send-portal-${discount.id}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {processingKey === `discount-send-portal-${discount.id}` ? 'Sending...' : 'Send Portal Invoice'}
                      </button>
                    ) : null}
                    {canSendAdmission ? (
                      <button
                        type="button"
                        onClick={() =>
                          runBillingAction({
                            action: 'send_payment_link',
                            feeCode: 'admission_fee',
                            parentEmail: discount.parentEmail || '',
                            studentId: discount.studentId,
                            discountIds: [discount.id],
                            processingId: `discount-send-admission-${discount.id}`,
                          })
                        }
                        disabled={processingKey === `discount-send-admission-${discount.id}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {processingKey === `discount-send-admission-${discount.id}` ? 'Sending...' : 'Send Admission Invoice'}
                      </button>
                    ) : null}
                    {canSendCombined ? (
                      <button
                        type="button"
                        onClick={() =>
                          runBillingAction({
                            action: 'send_combined_payment_link',
                            feeCode: 'admission_fee',
                            parentEmail: discount.parentEmail || '',
                            studentId: discount.studentId,
                            discountIds: [discount.id],
                            processingId: `discount-send-combined-${discount.id}`,
                          })
                        }
                        disabled={processingKey === `discount-send-combined-${discount.id}`}
                        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                      >
                        {processingKey === `discount-send-combined-${discount.id}` ? 'Sending...' : 'Send Combined'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onToggleDiscount(discount.id, !discount.isActive)}
                      disabled={processingKey === `discount-${discount.id}`}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {processingKey === `discount-${discount.id}` ? 'Saving...' : discount.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

import { Dispatch, FormEvent, SetStateAction } from 'react';
import { BillingDiscountRecord, DiscountFormState } from '../types';

interface DiscountsTabProps {
  discountForm: DiscountFormState;
  setDiscountForm: Dispatch<SetStateAction<DiscountFormState>>;
  couponForm: DiscountFormState;
  setCouponForm: Dispatch<SetStateAction<DiscountFormState>>;
  onSaveDiscount: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSaveCoupon: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  discountSaving: boolean;
  filteredDiscounts: BillingDiscountRecord[];
  onRefreshDiscounts: () => void | Promise<void>;
  onToggleDiscount: (discountId: string, isActive: boolean) => void | Promise<void>;
  processingKey: string | null;
}

const couponAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCouponCode() {
  const body = Array.from({ length: 6 }, () => couponAlphabet[Math.floor(Math.random() * couponAlphabet.length)]).join('');
  return `DRU-${body}`;
}

function normalizeCouponCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}

function getDiscountTargetLabel(discount: BillingDiscountRecord) {
  if (discount.scope === 'additional_student') return 'Additional students';
  if (discount.scope === 'coupon_code') return discount.couponCode || 'Coupon code';
  if (discount.scope === 'student') return discount.studentName || discount.studentId || 'Legacy student';
  return discount.parentEmail || 'Legacy family';
}

function feeLabel(feeCode: 'admission_fee' | 'parent_portal_yearly') {
  return feeCode === 'admission_fee' ? 'Admission Fee' : 'Parent Portal Fee';
}

export function DiscountsTab({
  discountForm,
  setDiscountForm,
  couponForm,
  setCouponForm,
  onSaveDiscount,
  onSaveCoupon,
  discountSaving,
  filteredDiscounts,
  onRefreshDiscounts,
  onToggleDiscount,
  processingKey,
}: DiscountsTabProps) {
  const additionalPreview =
    discountForm.value > 0 ? `${discountForm.value}% off additional students` : 'Set a percentage';
  const couponPreview = couponForm.value > 0 ? `${couponForm.value}% off with code` : 'Set a coupon percentage';

  const copyCouponCode = async (code: string) => {
    if (!code) return;
    await navigator.clipboard?.writeText(code);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={onSaveDiscount}
          className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Student Discount</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              A percentage discount for second, third, and later students in the same family. No parent selection needed.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Rule Name</span>
              <input
                type="text"
                value={discountForm.name}
                onChange={(event) => setDiscountForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Additional student discount"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Discount Percentage</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountForm.value}
                  onChange={(event) =>
                    setDiscountForm((current) => ({
                      ...current,
                      value: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-10 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
            </label>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Notes</span>
            <textarea
              value={discountForm.reason}
              onChange={(event) => setDiscountForm((current) => ({ ...current, reason: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Example: Applies after the first child in a family."
            />
          </label>

          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-100">
            {additionalPreview}
          </div>

          <button
            type="submit"
            disabled={discountSaving}
            className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {discountSaving ? 'Saving...' : 'Save Additional Student Discount'}
          </button>
        </form>

        <form
          onSubmit={onSaveCoupon}
          className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Coupon Code</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Create a reusable percentage code that can be typed manually or generated and copied.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Coupon Code</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponForm.couponCode}
                  onChange={(event) => {
                    const nextCode = normalizeCouponCode(event.target.value);
                    setCouponForm((current) => ({
                      ...current,
                      couponCode: nextCode,
                      name: nextCode ? `Coupon ${nextCode}` : 'Coupon code',
                    }));
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 font-mono uppercase dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="DRU-SAVE10"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextCode = generateCouponCode();
                    setCouponForm((current) => ({
                      ...current,
                      couponCode: nextCode,
                      name: `Coupon ${nextCode}`,
                    }));
                  }}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Generate
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Discount Percentage</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={couponForm.value}
                  onChange={(event) =>
                    setCouponForm((current) => ({
                      ...current,
                      value: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-10 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
            </label>
          </div>

          <div className="mt-5">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Applies To</span>
            <div className="flex flex-wrap gap-3">
              {[
                { code: 'admission_fee' as const, label: 'Admission Fee' },
                { code: 'parent_portal_yearly' as const, label: 'Parent Portal Fee' },
              ].map((fee) => (
                <label
                  key={fee.code}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  <input
                    type="checkbox"
                    checked={couponForm.feeCodes.includes(fee.code)}
                    onChange={(event) =>
                      setCouponForm((current) => ({
                        ...current,
                        feeCodes: event.target.checked
                          ? Array.from(new Set([...current.feeCodes, fee.code]))
                          : current.feeCodes.filter((code) => code !== fee.code),
                      }))
                    }
                  />
                  {fee.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{couponPreview}</p>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {couponForm.couponCode || 'Generate or enter a code before saving.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyCouponCode(couponForm.couponCode)}
              disabled={!couponForm.couponCode}
              className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              Copy Code
            </button>
          </div>

          <button
            type="submit"
            disabled={discountSaving}
            className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {discountSaving ? 'Saving...' : 'Save Coupon Code'}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Saved Discounts</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Active percentage discounts currently available to the billing system.
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
                      <p className="text-sm text-gray-500 dark:text-gray-400">{discount.value}%</p>
                      {discount.reason ? (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{discount.reason}</p>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-700 dark:text-gray-300">
                      <p>{getDiscountTargetLabel(discount)}</p>
                      {discount.scope === 'coupon_code' && discount.couponCode ? (
                        <button
                          type="button"
                          onClick={() => copyCouponCode(discount.couponCode || '')}
                          className="mt-2 rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200"
                        >
                          Copy
                        </button>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-700 dark:text-gray-300">
                      {discount.feeCodes.map(feeLabel).join(', ')}
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

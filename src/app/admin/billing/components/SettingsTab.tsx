import { Dispatch, FormEvent, SetStateAction } from 'react';
import { BillingSettingsState } from '../types';

interface SettingsTabProps {
  form: BillingSettingsState;
  setForm: Dispatch<SetStateAction<BillingSettingsState>>;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  settingsLoading: boolean;
  settingsMessage: string;
  saving: boolean;
}

export function SettingsTab({
  form,
  setForm,
  onSaveSettings,
  settingsLoading,
  settingsMessage,
  saving,
}: SettingsTabProps) {
  return (
    <form
      onSubmit={onSaveSettings}
      className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Settings</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure billing amounts and reminder settings for parent portal fees and admission fees.
        </p>
      </div>

      {settingsLoading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading billing settings...</p>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Admission Fee Amount (AUD)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.admissionFeeAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    admissionFeeAmount: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Parent Portal Yearly Fee (AUD)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.parentPortalYearlyFeeAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    parentPortalYearlyFeeAmount: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Invoice Due Days</span>
              <input
                type="number"
                min="1"
                value={form.invoiceDueDays}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    invoiceDueDays: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Reminder Days Before Due</span>
              <input
                type="text"
                value={form.reminderDaysBeforeDue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reminderDaysBeforeDue: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="3,1"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Support Email (optional)</span>
              <input
                type="email"
                value={form.supportEmail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supportEmail: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Support Phone (optional)</span>
              <input
                type="text"
                value={form.supportPhone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supportPhone: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
          </div>

          {settingsMessage && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {settingsMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Billing Settings'}
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Support email and phone are only used in invoice/help messaging. You can leave them blank.
          </p>
        </>
      )}
    </form>
  );
}

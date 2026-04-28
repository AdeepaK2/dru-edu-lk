import { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react';
import { BillingSettingsState } from '../types';

interface SettingsTabProps {
  form: BillingSettingsState;
  setForm: Dispatch<SetStateAction<BillingSettingsState>>;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  settingsLoading: boolean;
  settingsMessage: string;
  saving: boolean;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount || 0);
}

function SettingCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function FieldShell({
  children,
  helper,
  label,
}: {
  children: ReactNode;
  helper?: string;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
      {children}
      {helper ? <span className="mt-2 block text-xs leading-5 text-gray-500 dark:text-gray-400">{helper}</span> : null}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-blue-900/40';

export function SettingsTab({
  form,
  setForm,
  onSaveSettings,
  settingsLoading,
  settingsMessage,
  saving,
}: SettingsTabProps) {
  const reminderDays = form.reminderDaysBeforeDue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <form onSubmit={onSaveSettings} className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
              Payment Settings
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Billing rules</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Set the default amounts, due date, reminders, and support contact used when invoices are created.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
              <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Admission</p>
              <p className="mt-2 text-2xl font-bold text-blue-950 dark:text-white">
                {formatMoney(form.admissionFeeAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-900/50 dark:bg-violet-900/20">
              <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Portal yearly</p>
              <p className="mt-2 text-2xl font-bold text-violet-950 dark:text-white">
                {formatMoney(form.parentPortalYearlyFeeAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {settingsLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Loading billing settings...
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <SettingCard
                title="Fee Amounts"
                description="These are the base invoice amounts before any discount or coupon is applied."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell label="Admission Fee" helper="Charged per new student admission.">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                        AUD
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
                        className={`${inputClass} pl-14`}
                      />
                    </div>
                  </FieldShell>

                  <FieldShell label="Parent Portal Yearly Fee" helper="Charged once per parent account per year.">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                        AUD
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
                        className={`${inputClass} pl-14`}
                      />
                    </div>
                  </FieldShell>
                </div>
              </SettingCard>

              <SettingCard
                title="Invoice Timing"
                description="Control due dates and reminder timing for invoices sent from billing management."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell label="Invoice Due Days" helper="Number of days after invoice creation.">
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
                      className={inputClass}
                    />
                  </FieldShell>

                  <FieldShell label="Reminder Days Before Due" helper="Comma separated values, for example 3,1.">
                    <input
                      type="text"
                      value={form.reminderDaysBeforeDue}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reminderDaysBeforeDue: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="3,1"
                    />
                  </FieldShell>
                </div>
              </SettingCard>

              <SettingCard
                title="Support Contact"
                description="Shown in invoice/help messaging when parents need billing support."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell label="Support Email">
                    <input
                      type="email"
                      value={form.supportEmail}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          supportEmail: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="billing@drueducation.com"
                    />
                  </FieldShell>

                  <FieldShell label="Support Phone">
                    <input
                      type="text"
                      value={form.supportPhone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          supportPhone: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="+61..."
                    />
                  </FieldShell>
                </div>
              </SettingCard>
            </div>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Current invoice flow</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-white p-4 dark:bg-gray-700/60">
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">Due date</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {form.invoiceDueDays} day{form.invoiceDueDays === 1 ? '' : 's'} after sending
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4 dark:bg-gray-700/60">
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">Reminders</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {reminderDays.length > 0 ? (
                      reminderDays.map((day) => (
                        <span
                          key={day}
                          className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                        >
                          {day} day{day === '1' ? '' : 's'} before
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">No reminders configured</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 dark:bg-gray-700/60">
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">Support</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                    {form.supportEmail || form.supportPhone
                      ? [form.supportEmail, form.supportPhone].filter(Boolean).join(' / ')
                      : 'No support contact set'}
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <div className="sticky bottom-0 z-10 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {settingsMessage ? (
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{settingsMessage}</p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Changes apply to invoices created after saving.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

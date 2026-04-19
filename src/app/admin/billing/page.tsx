'use client';

import React, { useEffect, useState } from 'react';

interface BillingSettingsState {
  admissionFeeAmount: number;
  parentPortalYearlyFeeAmount: number;
  invoiceDueDays: number;
  reminderDaysBeforeDue: string;
  supportEmail: string;
  supportPhone: string;
}

const DEFAULT_STATE: BillingSettingsState = {
  admissionFeeAmount: 0,
  parentPortalYearlyFeeAmount: 0,
  invoiceDueDays: 7,
  reminderDaysBeforeDue: '3,1',
  supportEmail: '',
  supportPhone: '',
};

export default function BillingSettingsPage() {
  const [form, setForm] = useState<BillingSettingsState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/billing/settings');
        const data = await response.json();

        if (response.ok && data.success) {
          setForm({
            admissionFeeAmount: Number(data.data.admissionFeeAmount || 0),
            parentPortalYearlyFeeAmount: Number(data.data.parentPortalYearlyFeeAmount || 0),
            invoiceDueDays: Number(data.data.invoiceDueDays || 7),
            reminderDaysBeforeDue: Array.isArray(data.data.reminderDaysBeforeDue)
              ? data.data.reminderDaysBeforeDue.join(',')
              : '3,1',
            supportEmail: data.data.supportEmail || '',
            supportPhone: data.data.supportPhone || '',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage('');
      const response = await fetch('/api/billing/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissionFeeAmount: form.admissionFeeAmount,
          parentPortalYearlyFeeAmount: form.parentPortalYearlyFeeAmount,
          invoiceDueDays: form.invoiceDueDays,
          reminderDaysBeforeDue: form.reminderDaysBeforeDue
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value)),
          supportEmail: form.supportEmail,
          supportPhone: form.supportPhone,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setMessage('Billing settings saved successfully.');
    } catch (error: any) {
      setMessage(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure compulsory admission and parent portal fees.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800 space-y-6">
        {loading ? (
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
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Invoice Due Days
                </span>
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
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Reminder Days Before Due
                </span>
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
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Support Email
                </span>
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
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Support Phone
                </span>
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

            {message && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Billing Settings'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

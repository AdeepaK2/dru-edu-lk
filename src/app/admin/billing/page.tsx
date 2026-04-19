'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface BillingSettingsState {
  admissionFeeAmount: number;
  parentPortalYearlyFeeAmount: number;
  invoiceDueDays: number;
  reminderDaysBeforeDue: string;
  supportEmail: string;
  supportPhone: string;
}

interface BillingAccount {
  parentId?: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  students: Array<{
    studentId: string;
    studentName: string;
    studentEmail: string;
    year?: string;
    school?: string;
  }>;
  portalStatus: 'active' | 'payment_required' | 'expired' | 'none';
  portalPaidUntil: string | null;
  totalOutstandingAmount: number;
  outstandingInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    amountTotal: number;
    currency: string;
    dueAt: string | null;
    status: string;
  }>;
  latestPayment: {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    paidAt: string | null;
    provider: 'stripe' | 'manual' | 'unknown';
  } | null;
}

const DEFAULT_SETTINGS: BillingSettingsState = {
  admissionFeeAmount: 0,
  parentPortalYearlyFeeAmount: 0,
  invoiceDueDays: 7,
  reminderDaysBeforeDue: '3,1',
  supportEmail: '',
  supportPhone: '',
};

export default function BillingSettingsPage() {
  const [form, setForm] = useState<BillingSettingsState>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [summary, setSummary] = useState({
    totalParents: 0,
    activeParents: 0,
    lockedParents: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BillingAccount['portalStatus']>('all');
  const [actionMessage, setActionMessage] = useState('');
  const [processingParentEmail, setProcessingParentEmail] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
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
      setSettingsLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      setAccountsLoading(true);
      const response = await fetch('/api/billing/management');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load payment management data');
      }

      setAccounts(data.data.accounts || []);
      setSummary(
        data.data.summary || {
          totalParents: 0,
          activeParents: 0,
          lockedParents: 0,
          pendingInvoices: 0,
          overdueInvoices: 0,
        },
      );
    } catch (error: any) {
      setActionMessage(error.message || 'Failed to load payment management data');
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadAccounts();
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setSettingsMessage('');
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

      setSettingsMessage('Billing settings saved successfully.');
    } catch (error: any) {
      setSettingsMessage(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaidOffline = async (parentEmail: string) => {
    try {
      setProcessingParentEmail(parentEmail);
      setActionMessage('');
      const response = await fetch('/api/billing/management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid_offline',
          parentEmail,
          processedBy: 'admin-portal',
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to mark payment as paid');
      }

      setActionMessage(`Marked parent portal fee as paid for ${parentEmail}.`);
      await loadAccounts();
    } catch (error: any) {
      setActionMessage(error.message || 'Failed to mark payment as paid');
    } finally {
      setProcessingParentEmail(null);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const studentNames = account.students.map((student) => student.studentName).join(' ').toLowerCase();
      const matchesSearch =
        !searchTerm ||
        account.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.parentEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        studentNames.includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || account.portalStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [accounts, searchTerm, statusFilter]);

  const formatMoney = (amount: number, currency = 'AUD') =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount || 0);

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusPill = (status: BillingAccount['portalStatus']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'payment_required':
        return 'bg-amber-100 text-amber-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage parent portal billing, review current parent and student access, and mark manual payments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Parents', value: summary.totalParents },
          { label: 'Portal Active', value: summary.activeParents },
          { label: 'Portal Locked', value: summary.lockedParents },
          { label: 'Pending Invoices', value: summary.pendingInvoices },
          { label: 'Overdue Invoices', value: summary.overdueInvoices },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Parent Portal Accounts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              See which current students are under paid or unpaid parent portal accounts.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search parent or student"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="payment_required">Payment required</option>
              <option value="expired">Expired</option>
              <option value="none">No record</option>
            </select>
            <button
              type="button"
              onClick={loadAccounts}
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Refresh
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {actionMessage}
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                <th className="py-3 pr-4 font-medium">Parent</th>
                <th className="py-3 pr-4 font-medium">Students</th>
                <th className="py-3 pr-4 font-medium">Portal Status</th>
                <th className="py-3 pr-4 font-medium">Paid Until</th>
                <th className="py-3 pr-4 font-medium">Outstanding</th>
                <th className="py-3 pr-4 font-medium">Latest Payment</th>
                <th className="py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {accountsLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Loading payment management data...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No parent portal accounts found.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.parentEmail} className="align-top">
                    <td className="py-4 pr-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{account.parentName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{account.parentEmail}</p>
                        {account.parentPhone ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{account.parentPhone}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-2">
                        {account.students.length > 0 ? (
                          account.students.map((student) => (
                            <div key={student.studentId} className="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-gray-700/50">
                              <p className="font-medium text-gray-900 dark:text-white">{student.studentName}</p>
                              <p className="text-gray-500 dark:text-gray-400">{student.studentEmail}</p>
                              {(student.year || student.school) ? (
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
                    <td className="py-4 pr-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusPill(account.portalStatus)}`}>
                        {account.portalStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(account.portalPaidUntil)}
                    </td>
                    <td className="py-4 pr-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatMoney(account.totalOutstandingAmount)}
                      </p>
                      {account.outstandingInvoices.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                          {account.outstandingInvoices.map((invoice) => (
                            <p key={invoice.invoiceId}>
                              {invoice.invoiceNumber} • {formatMoney(invoice.amountTotal, invoice.currency)} • due {formatDate(invoice.dueAt)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No unpaid invoices</p>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-700 dark:text-gray-300">
                      {account.latestPayment ? (
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{account.latestPayment.invoiceNumber}</p>
                          <p>{formatMoney(account.latestPayment.amount)}</p>
                          <p className="capitalize text-gray-500 dark:text-gray-400">
                            {account.latestPayment.provider} • {formatDate(account.latestPayment.paidAt)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400">No payment recorded</p>
                      )}
                    </td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => handleMarkPaidOffline(account.parentEmail)}
                        disabled={processingParentEmail === account.parentEmail}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {processingParentEmail === account.parentEmail ? 'Saving...' : 'Mark Paid Offline'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Billing Settings</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure compulsory admission and yearly parent portal charges.
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
          </>
        )}
      </form>
    </div>
  );
}

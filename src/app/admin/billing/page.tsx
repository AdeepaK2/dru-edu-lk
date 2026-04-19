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

interface AdmissionFeeRecord {
  studentId: string;
  studentName: string;
  studentEmail: string;
  year?: string;
  school?: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  admissionStatus: 'paid' | 'payment_required' | 'none';
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

type BillingTab = 'parent_portal' | 'admission' | 'settings';

const DEFAULT_SETTINGS: BillingSettingsState = {
  admissionFeeAmount: 0,
  parentPortalYearlyFeeAmount: 0,
  invoiceDueDays: 7,
  reminderDaysBeforeDue: '3,1',
  supportEmail: '',
  supportPhone: '',
};

const DEFAULT_SUMMARY = {
  totalParents: 0,
  activeParents: 0,
  lockedParents: 0,
  pendingInvoices: 0,
  overdueInvoices: 0,
  admissionPaidStudents: 0,
  admissionPendingStudents: 0,
};

export default function BillingSettingsPage() {
  const [activeTab, setActiveTab] = useState<BillingTab>('parent_portal');
  const [form, setForm] = useState<BillingSettingsState>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [managementLoading, setManagementLoading] = useState(true);
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [admissionFees, setAdmissionFees] = useState<AdmissionFeeRecord[]>([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [searchTerm, setSearchTerm] = useState('');
  const [portalStatusFilter, setPortalStatusFilter] = useState<'all' | BillingAccount['portalStatus']>('all');
  const [admissionStatusFilter, setAdmissionStatusFilter] = useState<'all' | AdmissionFeeRecord['admissionStatus']>('all');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [processingKey, setProcessingKey] = useState<string | null>(null);

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

  const loadManagement = async () => {
    try {
      setManagementLoading(true);
      const response = await fetch('/api/billing/management');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load payment management data');
      }

      setAccounts(data.data.accounts || []);
      setAdmissionFees(data.data.admissionFees || []);
      setSummary(data.data.summary || DEFAULT_SUMMARY);
    } catch (error: any) {
      setActionError(error.message || 'Failed to load payment management data');
    } finally {
      setManagementLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadManagement();
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
      setActionError('');
    } catch (error: any) {
      setSettingsMessage(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const runBillingAction = async ({
    action,
    feeCode,
    parentEmail,
    studentId,
    processingId,
  }: {
    action: 'mark_paid_offline' | 'send_payment_link';
    feeCode: 'admission_fee' | 'parent_portal_yearly';
    parentEmail: string;
    studentId?: string;
    processingId: string;
  }) => {
    try {
      setProcessingKey(processingId);
      setActionMessage('');
      setActionError('');

      const response = await fetch('/api/billing/management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          feeCode,
          parentEmail,
          studentId,
          processedBy: 'admin-portal',
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Billing action failed');
      }

      setActionMessage(data.message || 'Billing action completed successfully.');
      await loadManagement();
    } catch (error: any) {
      setActionError(error.message || 'Billing action failed');
    } finally {
      setProcessingKey(null);
    }
  };

  const filteredAccounts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return accounts.filter((account) => {
      const studentNames = account.students.map((student) => student.studentName).join(' ').toLowerCase();
      const studentEmails = account.students.map((student) => student.studentEmail).join(' ').toLowerCase();
      const matchesSearch =
        !needle ||
        account.parentName.toLowerCase().includes(needle) ||
        account.parentEmail.toLowerCase().includes(needle) ||
        studentNames.includes(needle) ||
        studentEmails.includes(needle);

      const matchesStatus = portalStatusFilter === 'all' || account.portalStatus === portalStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [accounts, searchTerm, portalStatusFilter]);

  const filteredAdmissionFees = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return admissionFees.filter((record) => {
      const matchesSearch =
        !needle ||
        record.studentName.toLowerCase().includes(needle) ||
        record.studentEmail.toLowerCase().includes(needle) ||
        record.parentName.toLowerCase().includes(needle) ||
        record.parentEmail.toLowerCase().includes(needle);

      const matchesStatus =
        admissionStatusFilter === 'all' || record.admissionStatus === admissionStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [admissionFees, searchTerm, admissionStatusFilter]);

  const formatMoney = (amount: number, currency = 'AUD') =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount || 0);

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getPortalStatusPill = (status: BillingAccount['portalStatus']) => {
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

  const getAdmissionStatusPill = (status: AdmissionFeeRecord['admissionStatus']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'payment_required':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage parent portal fees, admission fees, billing settings, offline payments, and Stripe payment links.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Parents', value: summary.totalParents },
          { label: 'Portal Active', value: summary.activeParents },
          { label: 'Portal Locked', value: summary.lockedParents },
          { label: 'Pending Invoices', value: summary.pendingInvoices },
          { label: 'Admission Paid', value: summary.admissionPaidStudents },
          { label: 'Admission Pending', value: summary.admissionPendingStudents },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-800">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'parent_portal', label: 'Parent Portal Fees' },
            { key: 'admission', label: 'Admission Fees' },
            { key: 'settings', label: 'Payment Settings' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as BillingTab)}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {(actionMessage || actionError) && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            actionError
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {actionError || actionMessage}
        </div>
      )}

      {activeTab === 'parent_portal' && (
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Parent Portal Fees</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Send Stripe payment links or mark the yearly parent portal fee paid offline for existing parent accounts.
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
                value={portalStatusFilter}
                onChange={(event) => setPortalStatusFilter(event.target.value as typeof portalStatusFilter)}
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
                onClick={loadManagement}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Refresh
              </button>
            </div>
          </div>

          {form.parentPortalYearlyFeeAmount <= 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Parent portal yearly fee amount is not configured. Set it in the Payment Settings tab before sending Stripe links.
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
                  <th className="py-3 pr-4 font-medium">Outstanding Portal Fee</th>
                  <th className="py-3 pr-4 font-medium">Latest Portal Payment</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {managementLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      Loading parent portal fee data...
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
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getPortalStatusPill(account.portalStatus)}`}>
                          {account.portalStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-sm text-gray-700 dark:text-gray-300">{formatDate(account.portalPaidUntil)}</td>
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
                          <p className="text-sm text-gray-500 dark:text-gray-400">No unpaid portal fee invoices</p>
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
                          <p className="text-gray-500 dark:text-gray-400">No portal fee payment recorded</p>
                        )}
                      </td>
                      <td className="py-4">
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
                            disabled={processingKey === `send-parent-${account.parentEmail}` || form.parentPortalYearlyFeeAmount <= 0}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {processingKey === `send-parent-${account.parentEmail}` ? 'Sending...' : 'Send Stripe Link'}
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
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            {processingKey === `offline-parent-${account.parentEmail}` ? 'Saving...' : 'Mark Portal Fee Paid Offline'}
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
      )}

      {activeTab === 'admission' && (
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admission Fees</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track admission fee status per student and handle Stripe or offline payment separately from the parent portal fee.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search student or parent"
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <select
                value={admissionStatusFilter}
                onChange={(event) => setAdmissionStatusFilter(event.target.value as typeof admissionStatusFilter)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="payment_required">Payment required</option>
                <option value="none">No record</option>
              </select>
              <button
                type="button"
                onClick={loadManagement}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Refresh
              </button>
            </div>
          </div>

          {form.admissionFeeAmount <= 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Admission fee amount is not configured. Set it in the Payment Settings tab before sending Stripe links.
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th className="py-3 pr-4 font-medium">Student</th>
                  <th className="py-3 pr-4 font-medium">Parent</th>
                  <th className="py-3 pr-4 font-medium">Admission Status</th>
                  <th className="py-3 pr-4 font-medium">Outstanding Admission Fee</th>
                  <th className="py-3 pr-4 font-medium">Latest Admission Payment</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {managementLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      Loading admission fee data...
                    </td>
                  </tr>
                ) : filteredAdmissionFees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No admission fee records found.
                    </td>
                  </tr>
                ) : (
                  filteredAdmissionFees.map((record) => (
                    <tr key={record.studentId} className="align-top">
                      <td className="py-4 pr-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{record.studentName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{record.studentEmail}</p>
                          {(record.year || record.school) ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {[record.year, record.school].filter(Boolean).join(' • ')}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{record.parentName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{record.parentEmail}</p>
                          {record.parentPhone ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{record.parentPhone}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getAdmissionStatusPill(record.admissionStatus)}`}>
                          {record.admissionStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatMoney(record.totalOutstandingAmount)}
                        </p>
                        {record.outstandingInvoices.length > 0 ? (
                          <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                            {record.outstandingInvoices.map((invoice) => (
                              <p key={invoice.invoiceId}>
                                {invoice.invoiceNumber} • {formatMoney(invoice.amountTotal, invoice.currency)} • due {formatDate(invoice.dueAt)}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No unpaid admission fee invoices</p>
                        )}
                      </td>
                      <td className="py-4 pr-4 text-sm text-gray-700 dark:text-gray-300">
                        {record.latestPayment ? (
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{record.latestPayment.invoiceNumber}</p>
                            <p>{formatMoney(record.latestPayment.amount)}</p>
                            <p className="capitalize text-gray-500 dark:text-gray-400">
                              {record.latestPayment.provider} • {formatDate(record.latestPayment.paidAt)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400">No admission fee payment recorded</p>
                        )}
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              runBillingAction({
                                action: 'send_payment_link',
                                feeCode: 'admission_fee',
                                parentEmail: record.parentEmail,
                                studentId: record.studentId,
                                processingId: `send-admission-${record.studentId}`,
                              })
                            }
                            disabled={processingKey === `send-admission-${record.studentId}` || form.admissionFeeAmount <= 0}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {processingKey === `send-admission-${record.studentId}` ? 'Sending...' : 'Send Stripe Link'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              runBillingAction({
                                action: 'mark_paid_offline',
                                feeCode: 'admission_fee',
                                parentEmail: record.parentEmail,
                                studentId: record.studentId,
                                processingId: `offline-admission-${record.studentId}`,
                              })
                            }
                            disabled={processingKey === `offline-admission-${record.studentId}`}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            {processingKey === `offline-admission-${record.studentId}` ? 'Saving...' : 'Mark Admission Fee Paid Offline'}
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
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSave} className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800 space-y-6">
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
      )}
    </div>
  );
}

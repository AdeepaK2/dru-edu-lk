import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdmissionFeeRecord,
  BillingAccount,
  BillingDiscountRecord,
  BillingSettingsState,
  BillingSummary,
  BillingTab,
  DiscountFormState,
} from '../types';

const DEFAULT_SETTINGS: BillingSettingsState = {
  admissionFeeAmount: 0,
  parentPortalYearlyFeeAmount: 0,
  invoiceDueDays: 7,
  reminderDaysBeforeDue: '3,1',
  supportEmail: '',
  supportPhone: '',
};

const DEFAULT_SUMMARY: BillingSummary = {
  totalParents: 0,
  activeParents: 0,
  lockedParents: 0,
  pendingInvoices: 0,
  overdueInvoices: 0,
  admissionPaidStudents: 0,
  admissionPendingStudents: 0,
};

const DEFAULT_DISCOUNT_FORM: DiscountFormState = {
  name: '',
  scope: 'parent',
  type: 'percentage',
  value: 0,
  parentEmail: '',
  studentId: '',
  feeCodes: ['admission_fee'],
  reason: '',
};

export function useBillingDashboard() {
  const [activeTab, setActiveTab] = useState<BillingTab>('parent_portal');
  const [form, setForm] = useState<BillingSettingsState>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [managementLoading, setManagementLoading] = useState(true);
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [admissionFees, setAdmissionFees] = useState<AdmissionFeeRecord[]>([]);
  const [discounts, setDiscounts] = useState<BillingDiscountRecord[]>([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [searchTerm, setSearchTerm] = useState('');
  const [portalStatusFilter, setPortalStatusFilter] = useState<'all' | BillingAccount['portalStatus']>('all');
  const [admissionStatusFilter, setAdmissionStatusFilter] = useState<'all' | AdmissionFeeRecord['admissionStatus']>('all');
  const [discountForm, setDiscountForm] = useState<DiscountFormState>(DEFAULT_DISCOUNT_FORM);
  const [discountSaving, setDiscountSaving] = useState(false);
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

  const loadDiscounts = async () => {
    try {
      const response = await fetch('/api/billing/discounts');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load billing discounts');
      }

      setDiscounts(data.data || []);
    } catch (error: any) {
      setActionError(error.message || 'Failed to load billing discounts');
    }
  };

  useEffect(() => {
    loadSettings();
    loadManagement();
    loadDiscounts();
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
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
    action: 'mark_paid_offline' | 'send_payment_link' | 'send_combined_payment_link';
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

  const runBulkBillingAction = async ({
    processingId,
    items,
    successLabel,
  }: {
    processingId: string;
    items: Array<{
      parentEmail: string;
      studentId?: string;
      feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
    }>;
    successLabel: string;
  }) => {
    try {
      if (items.length === 0) {
        setActionError(`No ${successLabel.toLowerCase()} records found in the current filter.`);
        setActionMessage('');
        return;
      }

      setProcessingKey(processingId);
      setActionMessage('');
      setActionError('');

      const response = await fetch('/api/billing/management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_bulk_payment_links',
          items,
          processedBy: 'admin-portal',
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Bulk billing action failed');
      }

      setActionMessage(data.message || `${successLabel} payment links sent.`);
      await loadManagement();
    } catch (error: any) {
      setActionError(error.message || 'Bulk billing action failed');
    } finally {
      setProcessingKey(null);
    }
  };

  const handleSaveDiscount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setDiscountSaving(true);
      setActionMessage('');
      setActionError('');

      const selectedParent = accounts.find((account) => account.parentEmail === discountForm.parentEmail);
      const selectedStudent = admissionFees.find((student) => student.studentId === discountForm.studentId);

      const response = await fetch('/api/billing/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: discountForm.name,
          scope: discountForm.scope,
          type: discountForm.type,
          value: discountForm.value,
          parentEmail: discountForm.parentEmail,
          parentName: selectedParent?.parentName,
          studentId: discountForm.scope === 'student' ? discountForm.studentId : undefined,
          studentName: discountForm.scope === 'student' ? selectedStudent?.studentName : undefined,
          feeCodes: discountForm.feeCodes,
          reason: discountForm.reason,
          isActive: true,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save discount');
      }

      setDiscountForm(DEFAULT_DISCOUNT_FORM);
      setActionMessage(data.message || 'Discount saved successfully.');
      await loadDiscounts();
    } catch (error: any) {
      setActionError(error.message || 'Failed to save discount');
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleToggleDiscount = async (discountId: string, isActive: boolean) => {
    try {
      setProcessingKey(`discount-${discountId}`);
      setActionMessage('');
      setActionError('');

      const response = await fetch('/api/billing/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_active',
          discountId,
          isActive,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update discount');
      }

      setActionMessage(data.message || 'Discount updated successfully.');
      await loadDiscounts();
    } catch (error: any) {
      setActionError(error.message || 'Failed to update discount');
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

  const accountByParentEmail = useMemo(() => {
    return new Map(accounts.map((account) => [account.parentEmail, account] as const));
  }, [accounts]);

  const selectedParentStudents = useMemo(() => {
    if (!discountForm.parentEmail) return [];
    return admissionFees.filter((student) => student.parentEmail === discountForm.parentEmail);
  }, [admissionFees, discountForm.parentEmail]);

  const filteredDiscounts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return discounts.filter((discount) => {
      if (!needle) return true;
      return (
        discount.name.toLowerCase().includes(needle) ||
        discount.parentEmail.toLowerCase().includes(needle) ||
        (discount.parentName || '').toLowerCase().includes(needle) ||
        (discount.studentName || '').toLowerCase().includes(needle)
      );
    });
  }, [discounts, searchTerm]);

  const bulkPortalItems = useMemo(
    () =>
      filteredAccounts
        .filter((account) => account.portalStatus !== 'active')
        .map((account) => ({
          parentEmail: account.parentEmail,
          feeCodes: ['parent_portal_yearly'] as Array<'parent_portal_yearly'>,
        })),
    [filteredAccounts],
  );

  const bulkAdmissionItems = useMemo(
    () =>
      filteredAdmissionFees
        .filter((record) => record.admissionStatus !== 'paid')
        .map((record) => ({
          parentEmail: record.parentEmail,
          studentId: record.studentId,
          feeCodes: ['admission_fee'] as Array<'admission_fee'>,
        })),
    [filteredAdmissionFees],
  );

  const bulkCombinedItems = useMemo(
    () =>
      filteredAdmissionFees
        .filter(
          (record) =>
            record.admissionStatus !== 'paid' &&
            accountByParentEmail.get(record.parentEmail)?.portalStatus !== 'active',
        )
        .map((record) => ({
          parentEmail: record.parentEmail,
          studentId: record.studentId,
          feeCodes: ['admission_fee', 'parent_portal_yearly'] as Array<
            'admission_fee' | 'parent_portal_yearly'
          >,
        })),
    [filteredAdmissionFees, accountByParentEmail],
  );

  const formatMoney = (amount: number, currency = 'AUD') =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount || 0);

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
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

  return {
    accounts,
    actionError,
    actionMessage,
    activeTab,
    admissionFeeAmount: form.admissionFeeAmount,
    admissionStatusFilter,
    bulkAdmissionItems,
    bulkCombinedItems,
    bulkPortalItems,
    discountForm,
    discountSaving,
    filteredAccounts,
    filteredAdmissionFees,
    filteredDiscounts,
    form,
    formatDate,
    formatMoney,
    getAdmissionStatusPill,
    getPortalStatusPill,
    handleSave,
    handleSaveDiscount,
    handleToggleDiscount,
    loadDiscounts,
    loadManagement,
    managementLoading,
    parentPortalYearlyFeeAmount: form.parentPortalYearlyFeeAmount,
    portalStatusFilter,
    processingKey,
    runBillingAction,
    runBulkBillingAction,
    saving,
    searchTerm,
    selectedParentStudents,
    setActiveTab,
    setAdmissionStatusFilter,
    setDiscountForm,
    setForm,
    setPortalStatusFilter,
    setSearchTerm,
    settingsLoading,
    settingsMessage,
    summary,
    accountByParentEmail,
  };
}

export type BillingDashboardState = ReturnType<typeof useBillingDashboard>;

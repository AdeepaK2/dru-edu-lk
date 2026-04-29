import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdmissionFeeRecord,
  BillingAccount,
  BillingDiscountRecord,
  BillingPaymentParentRow,
  BillingPaymentStudent,
  BillingSettingsState,
  BillingSummary,
  BillingTab,
  DiscountFormState,
  FeePaymentStatus,
  FeePaymentStatusFilter,
  PaymentStatusFilter,
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
  name: 'Additional student discount',
  scope: 'additional_student',
  value: 0,
  couponCode: '',
  feeCodes: ['admission_fee'],
  reason: '',
};

const DEFAULT_COUPON_FORM: DiscountFormState = {
  name: 'Coupon code',
  scope: 'coupon_code',
  value: 0,
  couponCode: '',
  feeCodes: ['admission_fee', 'parent_portal_yearly'],
  reason: '',
};

type BulkBillingItem = {
  parentEmail: string;
  studentId?: string;
  feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
};

export function useBillingDashboard() {
  const [activeTab, setActiveTab] = useState<BillingTab>('payments');
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
  const [portalStatusFilter, setPortalStatusFilter] = useState<FeePaymentStatusFilter>('all');
  const [admissionStatusFilter, setAdmissionStatusFilter] = useState<FeePaymentStatusFilter>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('all');
  const [paymentPageSize, setPaymentPageSize] = useState(10);
  const [paymentPage, setPaymentPage] = useState(1);
  const [discountForm, setDiscountForm] = useState<DiscountFormState>(DEFAULT_DISCOUNT_FORM);
  const [couponForm, setCouponForm] = useState<DiscountFormState>(DEFAULT_COUPON_FORM);
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

  useEffect(() => {
    setPaymentPage(1);
  }, [searchTerm, portalStatusFilter, admissionStatusFilter, paymentStatusFilter, paymentPageSize]);

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
    discountIds,
    couponCode,
    processingId,
  }: {
    action: 'mark_paid_offline' | 'send_payment_link' | 'send_combined_payment_link';
    feeCode: 'admission_fee' | 'parent_portal_yearly';
    parentEmail: string;
    studentId?: string;
    discountIds?: string[];
    couponCode?: string;
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
          discountIds,
          couponCode,
          processedBy: 'admin-portal',
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Billing action failed');
      }

      setActionMessage(data.message || 'Billing action completed successfully.');
      await loadManagement();
      return true;
    } catch (error: any) {
      setActionError(error.message || 'Billing action failed');
      return false;
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
        return false;
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
      return true;
    } catch (error: any) {
      setActionError(error.message || 'Bulk billing action failed');
      return false;
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

      const response = await fetch('/api/billing/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: discountForm.name,
          scope: 'additional_student',
          type: 'percentage',
          value: discountForm.value,
          feeCodes: ['admission_fee'],
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

  const handleSaveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const couponCode = couponForm.couponCode.trim().toUpperCase();
      if (!couponCode) {
        throw new Error('Enter or generate a coupon code before saving.');
      }

      if (couponForm.feeCodes.length === 0) {
        throw new Error('Select at least one fee for this coupon.');
      }

      setDiscountSaving(true);
      setActionMessage('');
      setActionError('');

      const response = await fetch('/api/billing/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: couponForm.name,
          scope: 'coupon_code',
          type: 'percentage',
          value: couponForm.value,
          couponCode,
          feeCodes: couponForm.feeCodes,
          reason: couponForm.reason,
          isActive: true,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save coupon code');
      }

      setCouponForm(DEFAULT_COUPON_FORM);
      setActionMessage(data.message || 'Coupon code saved successfully.');
      await loadDiscounts();
    } catch (error: any) {
      setActionError(error.message || 'Failed to save coupon code');
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

  const getPortalPaymentStatus = (account: BillingAccount): FeePaymentStatus => {
    if (account.portalStatus === 'active') return 'paid';
    if (account.outstandingInvoices.length > 0 || account.portalStatus === 'payment_required') {
      return 'invoice_sent';
    }
    return 'unpaid';
  };

  const getAdmissionPaymentStatus = (record: AdmissionFeeRecord): FeePaymentStatus => {
    if (record.admissionStatus === 'paid') return 'paid';
    if (record.outstandingInvoices.length > 0 || record.admissionStatus === 'payment_required') {
      return 'invoice_sent';
    }
    return 'unpaid';
  };

  const paymentRows = useMemo<BillingPaymentParentRow[]>(() => {
    const admissionByParentEmail = new Map<string, AdmissionFeeRecord[]>();

    admissionFees.forEach((record) => {
      const parentEmail = record.parentEmail.toLowerCase();
      const existing = admissionByParentEmail.get(parentEmail) || [];
      existing.push(record);
      admissionByParentEmail.set(parentEmail, existing);
    });

    return accounts.map((account) => {
      const admissionRecords = admissionByParentEmail.get(account.parentEmail.toLowerCase()) || [];
      const admissionStudentsByKey = new Map<string, BillingPaymentStudent>();

      admissionRecords.forEach((record) => {
        admissionStudentsByKey.set(record.studentId || record.studentEmail, {
          studentId: record.studentId,
          studentName: record.studentName,
          studentEmail: record.studentEmail,
          year: record.year,
          school: record.school,
          canManageAdmission: true,
          paymentStatus: getAdmissionPaymentStatus(record),
          admissionStatus: record.admissionStatus,
          totalOutstandingAmount: record.totalOutstandingAmount,
          outstandingInvoices: record.outstandingInvoices,
          latestPayment: record.latestPayment,
        });
      });

      account.students.forEach((student) => {
        const key = student.studentId || student.studentEmail;
        if (!key || admissionStudentsByKey.has(key)) return;

        admissionStudentsByKey.set(key, {
          studentId: student.studentId,
          studentName: student.studentName,
          studentEmail: student.studentEmail,
          year: student.year,
          school: student.school,
          canManageAdmission: false,
          paymentStatus: 'unpaid',
          admissionStatus: 'none',
          totalOutstandingAmount: 0,
          outstandingInvoices: [],
          latestPayment: null,
        });
      });

      return {
        parentId: account.parentId,
        parentName: account.parentName,
        parentEmail: account.parentEmail,
        parentPhone: account.parentPhone,
        portalStatus: account.portalStatus,
        portalPaymentStatus: getPortalPaymentStatus(account),
        portalPaidUntil: account.portalPaidUntil,
        portalOutstandingAmount: account.totalOutstandingAmount,
        portalOutstandingInvoices: account.outstandingInvoices,
        portalLatestPayment: account.latestPayment,
        students: [...admissionStudentsByKey.values()].sort((a, b) =>
          a.studentName.localeCompare(b.studentName),
        ),
      };
    });
  }, [accounts, admissionFees]);

  const filteredPaymentRows = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return paymentRows.filter((row) => {
      const studentNames = row.students.map((student) => student.studentName).join(' ').toLowerCase();
      const studentEmails = row.students.map((student) => student.studentEmail).join(' ').toLowerCase();
      const matchesSearch =
        !needle ||
        row.parentName.toLowerCase().includes(needle) ||
        row.parentEmail.toLowerCase().includes(needle) ||
        (row.parentPhone || '').toLowerCase().includes(needle) ||
        studentNames.includes(needle) ||
        studentEmails.includes(needle);

      const matchesPortalStatus = portalStatusFilter === 'all' || row.portalPaymentStatus === portalStatusFilter;
      const matchesAdmissionStatus =
        admissionStatusFilter === 'all' ||
        row.students.some((student) => student.paymentStatus === admissionStatusFilter);
      const isFullyPaid =
        row.portalPaymentStatus === 'paid' &&
        row.students.every((student) => student.paymentStatus === 'paid');
      const matchesPaymentStatus =
        paymentStatusFilter === 'all' ||
        (paymentStatusFilter === 'fully_paid' && isFullyPaid) ||
        (paymentStatusFilter === 'any_unpaid' && !isFullyPaid);

      return matchesSearch && matchesPortalStatus && matchesAdmissionStatus && matchesPaymentStatus;
    });
  }, [admissionStatusFilter, paymentRows, paymentStatusFilter, portalStatusFilter, searchTerm]);

  const paymentPageCount = Math.max(1, Math.ceil(filteredPaymentRows.length / paymentPageSize));
  const safePaymentPage = Math.min(paymentPage, paymentPageCount);
  const paymentStartIndex = filteredPaymentRows.length === 0 ? 0 : (safePaymentPage - 1) * paymentPageSize + 1;
  const paymentEndIndex = Math.min(safePaymentPage * paymentPageSize, filteredPaymentRows.length);
  const paginatedPaymentRows = useMemo(() => {
    const start = (safePaymentPage - 1) * paymentPageSize;
    return filteredPaymentRows.slice(start, start + paymentPageSize);
  }, [filteredPaymentRows, paymentPageSize, safePaymentPage]);

  const filteredDiscounts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return discounts.filter((discount) => {
      if (!needle) return true;
      return (
        discount.name.toLowerCase().includes(needle) ||
        (discount.parentEmail || '').toLowerCase().includes(needle) ||
        (discount.parentName || '').toLowerCase().includes(needle) ||
        (discount.studentName || '').toLowerCase().includes(needle) ||
        (discount.couponCode || '').toLowerCase().includes(needle)
      );
    });
  }, [discounts, searchTerm]);

  const bulkPortalItems = useMemo(
    () =>
      filteredPaymentRows
        .filter((row) => row.portalPaymentStatus !== 'paid')
        .map((row) => ({
          parentEmail: row.parentEmail,
          feeCodes: ['parent_portal_yearly'] as Array<'parent_portal_yearly'>,
        })),
    [filteredPaymentRows],
  );

  const bulkAdmissionItems = useMemo(
    () =>
      filteredPaymentRows
        .flatMap((row) =>
          row.students
            .filter((student) => student.paymentStatus !== 'paid')
            .filter((student) => student.canManageAdmission)
            .map((student) => ({
              parentEmail: row.parentEmail,
              studentId: student.studentId,
              feeCodes: ['admission_fee'] as Array<'admission_fee'>,
            })),
        ),
    [filteredPaymentRows],
  );

  const bulkCombinedItems = useMemo<BulkBillingItem[]>(
    () =>
      filteredPaymentRows.flatMap<BulkBillingItem>((row) => {
        const portalUnpaid = row.portalPaymentStatus !== 'paid';
        const unpaidAdmissionStudents = row.students
          .filter((student) => student.paymentStatus !== 'paid')
          .filter((student) => student.canManageAdmission);

        if (portalUnpaid && unpaidAdmissionStudents.length === 1) {
          return [
            {
              parentEmail: row.parentEmail,
              studentId: unpaidAdmissionStudents[0].studentId,
              feeCodes: ['admission_fee', 'parent_portal_yearly'] as Array<
                'admission_fee' | 'parent_portal_yearly'
              >,
            },
          ];
        }

        return [
          ...(portalUnpaid
            ? [
                {
                  parentEmail: row.parentEmail,
                  feeCodes: ['parent_portal_yearly'] as Array<'parent_portal_yearly'>,
                },
              ]
            : []),
          ...unpaidAdmissionStudents.map((student) => ({
            parentEmail: row.parentEmail,
            studentId: student.studentId,
            feeCodes: ['admission_fee'] as Array<'admission_fee'>,
          })),
        ];
      }),
    [filteredPaymentRows],
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
    couponForm,
    discountForm,
    discountSaving,
    filteredDiscounts,
    filteredPaymentRows,
    form,
    formatDate,
    formatMoney,
    handleSave,
    handleSaveCoupon,
    handleSaveDiscount,
    handleToggleDiscount,
    loadDiscounts,
    loadManagement,
    managementLoading,
    paginatedPaymentRows,
    parentPortalYearlyFeeAmount: form.parentPortalYearlyFeeAmount,
    paymentEndIndex,
    paymentPage: safePaymentPage,
    paymentPageCount,
    paymentPageSize,
    paymentRows,
    paymentStartIndex,
    paymentStatusFilter,
    portalStatusFilter,
    processingKey,
    runBillingAction,
    runBulkBillingAction,
    saving,
    searchTerm,
    setActiveTab,
    setAdmissionStatusFilter,
    setCouponForm,
    setDiscountForm,
    setForm,
    setPaymentPage,
    setPaymentPageSize,
    setPaymentStatusFilter,
    setPortalStatusFilter,
    setSearchTerm,
    settingsLoading,
    settingsMessage,
    summary,
  };
}

export type BillingDashboardState = ReturnType<typeof useBillingDashboard>;

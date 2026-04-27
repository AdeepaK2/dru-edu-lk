import { DiscountsTab } from './DiscountsTab';
import { PaymentsTab } from './PaymentsTab';
import { SettingsTab } from './SettingsTab';
import type { BillingDashboardState } from '../hooks/useBillingDashboard';

interface BillingTabContentProps {
  dashboard: BillingDashboardState;
}

export function BillingTabContent({ dashboard }: BillingTabContentProps) {
  if (dashboard.activeTab === 'payments') {
    return (
      <PaymentsTab
        rows={dashboard.paginatedPaymentRows}
        filteredCount={dashboard.filteredPaymentRows.length}
        totalCount={dashboard.paymentRows.length}
        searchTerm={dashboard.searchTerm}
        onSearchTermChange={dashboard.setSearchTerm}
        portalStatusFilter={dashboard.portalStatusFilter}
        onPortalStatusFilterChange={dashboard.setPortalStatusFilter}
        admissionStatusFilter={dashboard.admissionStatusFilter}
        onAdmissionStatusFilterChange={dashboard.setAdmissionStatusFilter}
        paymentStatusFilter={dashboard.paymentStatusFilter}
        onPaymentStatusFilterChange={dashboard.setPaymentStatusFilter}
        page={dashboard.paymentPage}
        pageCount={dashboard.paymentPageCount}
        pageSize={dashboard.paymentPageSize}
        onPageChange={dashboard.setPaymentPage}
        onPageSizeChange={dashboard.setPaymentPageSize}
        startIndex={dashboard.paymentStartIndex}
        endIndex={dashboard.paymentEndIndex}
        onRefresh={dashboard.loadManagement}
        runBulkBillingAction={dashboard.runBulkBillingAction}
        bulkPortalItems={dashboard.bulkPortalItems}
        bulkAdmissionItems={dashboard.bulkAdmissionItems}
        bulkCombinedItems={dashboard.bulkCombinedItems}
        processingKey={dashboard.processingKey}
        admissionFeeAmount={dashboard.admissionFeeAmount}
        parentPortalYearlyFeeAmount={dashboard.parentPortalYearlyFeeAmount}
        managementLoading={dashboard.managementLoading}
        runBillingAction={dashboard.runBillingAction}
        formatMoney={dashboard.formatMoney}
        formatDate={dashboard.formatDate}
      />
    );
  }

  if (dashboard.activeTab === 'discounts') {
    return (
      <DiscountsTab
        discountForm={dashboard.discountForm}
        setDiscountForm={dashboard.setDiscountForm}
        onSaveDiscount={dashboard.handleSaveDiscount}
        discountSaving={dashboard.discountSaving}
        accounts={dashboard.accounts}
        selectedParentStudents={dashboard.selectedParentStudents}
        filteredDiscounts={dashboard.filteredDiscounts}
        onRefreshDiscounts={dashboard.loadDiscounts}
        onToggleDiscount={dashboard.handleToggleDiscount}
        runBillingAction={dashboard.runBillingAction}
        processingKey={dashboard.processingKey}
        formatMoney={dashboard.formatMoney}
      />
    );
  }

  return (
    <SettingsTab
      form={dashboard.form}
      setForm={dashboard.setForm}
      onSaveSettings={dashboard.handleSave}
      settingsLoading={dashboard.settingsLoading}
      settingsMessage={dashboard.settingsMessage}
      saving={dashboard.saving}
    />
  );
}

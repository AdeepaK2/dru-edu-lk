import { AdmissionTab } from './AdmissionTab';
import { DiscountsTab } from './DiscountsTab';
import { ParentPortalTab } from './ParentPortalTab';
import { SettingsTab } from './SettingsTab';
import type { BillingDashboardState } from '../hooks/useBillingDashboard';

interface BillingTabContentProps {
  dashboard: BillingDashboardState;
}

export function BillingTabContent({ dashboard }: BillingTabContentProps) {
  if (dashboard.activeTab === 'parent_portal') {
    return (
      <ParentPortalTab
        filteredAccounts={dashboard.filteredAccounts}
        searchTerm={dashboard.searchTerm}
        onSearchTermChange={dashboard.setSearchTerm}
        portalStatusFilter={dashboard.portalStatusFilter}
        onPortalStatusFilterChange={dashboard.setPortalStatusFilter}
        onRefresh={dashboard.loadManagement}
        runBulkBillingAction={dashboard.runBulkBillingAction}
        bulkPortalItems={dashboard.bulkPortalItems}
        processingKey={dashboard.processingKey}
        parentPortalYearlyFeeAmount={dashboard.parentPortalYearlyFeeAmount}
        managementLoading={dashboard.managementLoading}
        runBillingAction={dashboard.runBillingAction}
        formatMoney={dashboard.formatMoney}
        formatDate={dashboard.formatDate}
        getPortalStatusPill={dashboard.getPortalStatusPill}
      />
    );
  }

  if (dashboard.activeTab === 'admission') {
    return (
      <AdmissionTab
        filteredAdmissionFees={dashboard.filteredAdmissionFees}
        searchTerm={dashboard.searchTerm}
        onSearchTermChange={dashboard.setSearchTerm}
        admissionStatusFilter={dashboard.admissionStatusFilter}
        onAdmissionStatusFilterChange={dashboard.setAdmissionStatusFilter}
        onRefresh={dashboard.loadManagement}
        runBulkBillingAction={dashboard.runBulkBillingAction}
        bulkAdmissionItems={dashboard.bulkAdmissionItems}
        bulkCombinedItems={dashboard.bulkCombinedItems}
        processingKey={dashboard.processingKey}
        admissionFeeAmount={dashboard.admissionFeeAmount}
        parentPortalYearlyFeeAmount={dashboard.parentPortalYearlyFeeAmount}
        managementLoading={dashboard.managementLoading}
        runBillingAction={dashboard.runBillingAction}
        formatMoney={dashboard.formatMoney}
        formatDate={dashboard.formatDate}
        getAdmissionStatusPill={dashboard.getAdmissionStatusPill}
        accountByParentEmail={dashboard.accountByParentEmail}
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

'use client';

import { BillingActionBanner } from './components/BillingActionBanner';
import { BillingPageHeader } from './components/BillingPageHeader';
import { BillingSummaryCards } from './components/BillingSummaryCards';
import { BillingTabContent } from './components/BillingTabContent';
import { BillingTabs } from './components/BillingTabs';
import { useBillingDashboard } from './hooks/useBillingDashboard';

export default function BillingSettingsPage() {
  const dashboard = useBillingDashboard();

  return (
    <div className="space-y-6 pb-6">
      <BillingPageHeader />
      <BillingSummaryCards summary={dashboard.summary} loading={dashboard.managementLoading} />
      <BillingTabs activeTab={dashboard.activeTab} onTabChange={dashboard.setActiveTab} />
      <BillingActionBanner actionMessage={dashboard.actionMessage} actionError={dashboard.actionError} />
      <BillingTabContent dashboard={dashboard} />
    </div>
  );
}

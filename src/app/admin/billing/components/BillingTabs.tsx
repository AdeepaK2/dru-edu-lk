import { BillingTab } from '../types';

interface BillingTabsProps {
  activeTab: BillingTab;
  onTabChange: (tab: BillingTab) => void;
}

const TABS: Array<{ key: BillingTab; label: string }> = [
  { key: 'payments', label: 'Payments' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'settings', label: 'Payment Settings' },
];

export function BillingTabs({ activeTab, onTabChange }: BillingTabsProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

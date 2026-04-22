interface BillingActionBannerProps {
  actionMessage: string;
  actionError: string;
}

export function BillingActionBanner({ actionMessage, actionError }: BillingActionBannerProps) {
  if (!actionMessage && !actionError) {
    return null;
  }

  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm ${
        actionError
          ? 'border border-red-200 bg-red-50 text-red-700'
          : 'border border-blue-200 bg-blue-50 text-blue-700'
      }`}
    >
      {actionError || actionMessage}
    </div>
  );
}

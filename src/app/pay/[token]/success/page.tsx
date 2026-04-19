'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function BillingPaymentSuccessPage() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(
    'Thank you. DRU EDU is now finalizing the enrollment and parent portal access.',
  );
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      setStatus('success');
      return;
    }

    const reconcile = async () => {
      try {
        const response = await fetch('/api/billing/reconcile-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to finalize payment');
        }

        setMessage('Payment has been confirmed and DRU EDU has updated the billing record.');
        setStatus('success');
      } catch (error: any) {
        setMessage(
          error?.message ||
            'Payment was received, but billing finalization is still pending. Please refresh shortly or contact admin.',
        );
        setStatus('error');
      }
    };

    reconcile();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg">
        <h1 className="text-3xl font-semibold text-slate-900">Payment Received</h1>
        <p className="mt-4 text-slate-600">{message}</p>
        <p className="mt-2 text-slate-600">
          If this is your first parent portal payment, you will receive an invite email shortly.
        </p>
        {status === 'loading' ? (
          <p className="mt-4 text-sm font-medium text-blue-700">Checking payment status...</p>
        ) : status === 'success' ? (
          <p className="mt-4 text-sm font-medium text-green-700">Billing finalized successfully.</p>
        ) : (
          <p className="mt-4 text-sm font-medium text-amber-700">
            Billing is still reconciling. If access does not update soon, contact admin.
          </p>
        )}
      </div>
    </div>
  );
}

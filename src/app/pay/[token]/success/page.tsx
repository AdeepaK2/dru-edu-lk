'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function BillingPaymentSuccessPage() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(
    'Thank you. Dr U Education is now finalizing your billing record and parent portal access.',
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

        setMessage('Payment has been confirmed and Dr U Education has updated the billing record.');
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_42%,_#f8fafc)] px-4 py-12">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_55%,#0f172a_100%)] px-8 py-10 text-white">
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
            Dr U Education
          </div>
          <h1 className="mt-6 text-4xl font-semibold">Payment Received</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-blue-100/90">
            Your payment has been submitted successfully. We are now confirming the billing record and portal access.
          </p>
        </div>

        <div className="px-8 py-10">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6">
            <p className="text-base leading-7 text-slate-700">{message}</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              If this is your first parent portal payment, you will receive a parent invite email shortly.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {status === 'loading'
                  ? 'Checking'
                  : status === 'success'
                    ? 'Confirmed'
                    : 'Pending Review'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Portal Access</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {status === 'success' ? 'Updating Now' : 'Pending'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Next Step</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {status === 'success' ? 'Check Email' : 'Please Wait'}
              </p>
            </div>
          </div>

          <div
            className={`mt-6 rounded-2xl px-5 py-4 text-sm font-medium ${
              status === 'loading'
                ? 'border border-blue-200 bg-blue-50 text-blue-700'
                : status === 'success'
                  ? 'border border-green-200 bg-green-50 text-green-700'
                  : 'border border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {status === 'loading'
              ? 'Checking payment status...'
              : status === 'success'
                ? 'Billing finalized successfully.'
                : 'Billing is still reconciling. If access does not update soon, please contact admin.'}
          </div>
        </div>
      </div>
    </div>
  );
}

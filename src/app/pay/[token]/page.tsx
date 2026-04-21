'use client';

import React, { use, useEffect, useMemo, useState } from 'react';

interface PublicInvoice {
  id: string;
  invoiceNumber: string;
  parentName: string;
  studentName: string;
  className: string;
  subject: string;
  currency: string;
  status: string;
  amountTotal: number;
  dueAt: string | null;
  lineItems: Array<{
    type: string;
    label: string;
    description: string;
    amount: number;
    quantity: number;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

export default function BillingInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const [token] = useState(resolvedParams.token);
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    const loadInvoice = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`/api/billing/invoice?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Invoice not found');
        }

        setInvoice(data.data);
      } catch (loadError: any) {
        setError(loadError.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [token]);

  const dueDateLabel = useMemo(() => {
    if (!invoice?.dueAt) return 'As soon as possible';
    const parsed = new Date(invoice.dueAt);
    return Number.isNaN(parsed.getTime())
      ? 'As soon as possible'
      : parsed.toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  }, [invoice?.dueAt]);

  const statusLabel = useMemo(() => {
    if (!invoice) return '';
    return invoice.status === 'paid' ? 'Paid' : 'Payment Required';
  }, [invoice]);

  const handleCheckout = async () => {
    if (!invoice) return;

    try {
      setPaying(true);
      setError('');
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceToken: token,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.data?.url) {
        throw new Error(data.error || 'Failed to start checkout');
      }

      window.location.href = data.data.url;
    } catch (checkoutError: any) {
      setError(checkoutError.message || 'Failed to start checkout');
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_40%,_#f8fafc)] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_55%,#0f172a_100%)] px-8 py-10 text-white lg:px-10 lg:py-12">
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                Dr U Education
              </div>
              <h1 className="mt-6 text-4xl font-semibold leading-tight lg:text-5xl">
                Secure Invoice Payment
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-blue-100/90">
                Review your billing request, confirm the charges, and continue to Stripe for secure card payment.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-100/80">Invoice</p>
                  <p className="mt-2 text-xl font-semibold">{invoice?.invoiceNumber || 'Loading...'}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-100/80">Status</p>
                  <p className="mt-2 text-xl font-semibold">{statusLabel || 'Loading...'}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-100/80">Student</p>
                  <p className="mt-2 text-xl font-semibold">{invoice?.studentName || 'Loading...'}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-100/80">Due</p>
                  <p className="mt-2 text-xl font-semibold">{dueDateLabel}</p>
                </div>
              </div>

              <div className="mt-10 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100/80">
                  Payment Summary
                </p>
                <p className="mt-3 text-4xl font-bold">{invoice ? formatCurrency(invoice.amountTotal) : '—'}</p>
                <p className="mt-2 text-sm leading-6 text-blue-100/80">
                  Your payment will be processed securely by Stripe. Dr U Education will automatically update your billing record once payment is confirmed.
                </p>
              </div>
            </section>

            <section className="px-6 py-8 lg:px-8 lg:py-10">
              {loading && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
                  Loading invoice details...
                </div>
              )}

              {!loading && error && (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
                  {error}
                </div>
              )}

              {!loading && invoice && (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.14em] text-slate-500">Billed To</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">
                          {invoice.parentName || 'Parent'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Class</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {invoice.className || 'General billing'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Subject</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {invoice.subject || 'Billing'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h2 className="text-lg font-semibold text-slate-900">Charge Breakdown</h2>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {invoice.lineItems.map((item, index) => (
                        <div
                          key={`${item.type}-${index}`}
                          className="flex items-start justify-between gap-4 px-5 py-4"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{item.label}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {item.description}
                            </p>
                          </div>
                          <p className="shrink-0 text-base font-semibold text-slate-900">
                            {formatCurrency(item.amount * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between rounded-b-3xl bg-slate-50 px-5 py-5">
                      <div>
                        <p className="text-sm uppercase tracking-[0.12em] text-slate-500">Total Due</p>
                        <p className="mt-1 text-3xl font-bold text-slate-900">
                          {formatCurrency(invoice.amountTotal)}
                        </p>
                      </div>
                      {invoice.status !== 'paid' ? (
                        <button
                          type="button"
                          onClick={handleCheckout}
                          disabled={paying}
                          className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                        >
                          {paying ? 'Redirecting...' : 'Continue to Stripe'}
                        </button>
                      ) : (
                        <div className="rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-700">
                          Already Paid
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-slate-600">
                    This is a secure payment page for Dr U Education. Do not share this payment link with anyone outside your family.
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

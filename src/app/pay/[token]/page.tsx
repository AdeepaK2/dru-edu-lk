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
  const [token, setToken] = useState(resolvedParams.token);
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
    if (!invoice?.dueAt) return null;
    return new Date(invoice.dueAt).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [invoice?.dueAt]);

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
    <div className="min-h-screen bg-slate-100 py-12 px-4">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-blue-700 px-8 py-10 text-white">
          <h1 className="text-3xl font-semibold">DRU EDU Billing</h1>
          <p className="mt-2 text-blue-100">
            Complete payment for parent portal access and enrollment finalization.
          </p>
        </div>

        <div className="px-8 py-8">
          {loading && <p className="text-slate-600">Loading invoice...</p>}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          {!loading && invoice && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Invoice</p>
                  <p className="text-lg font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Status</p>
                  <p className="text-lg font-semibold text-slate-900 capitalize">{invoice.status}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Parent</p>
                  <p className="text-lg font-semibold text-slate-900">{invoice.parentName || 'Parent'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Student</p>
                  <p className="text-lg font-semibold text-slate-900">{invoice.studentName}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Class</p>
                  <p className="text-lg font-semibold text-slate-900">{invoice.className}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Due</p>
                  <p className="text-lg font-semibold text-slate-900">{dueDateLabel || 'As soon as possible'}</p>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-900">Charge Summary</h2>
                <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {invoice.lineItems.map((item, index) => (
                    <div key={`${item.type}-${index}`} className="flex items-start justify-between gap-4 px-4 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{item.label}</p>
                        <p className="text-sm text-slate-500">{item.description}</p>
                      </div>
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(item.amount * item.quantity)}
                      </p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-4 bg-slate-50">
                    <p className="text-lg font-semibold text-slate-900">Total</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(invoice.amountTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {invoice.status !== 'paid' ? (
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={paying}
                  className="w-full rounded-xl bg-blue-700 px-5 py-4 text-lg font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
                >
                  {paying ? 'Redirecting to secure checkout...' : 'Pay Parent Portal Fee'}
                </button>
              ) : (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-green-800">
                  Payment has already been completed for this invoice.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

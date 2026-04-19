export default function BillingPaymentCancelPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg">
        <h1 className="text-3xl font-semibold text-slate-900">Payment Not Completed</h1>
        <p className="mt-4 text-slate-600">
          Your invoice is still open. You can return to the invoice page and pay when you are ready.
        </p>
      </div>
    </div>
  );
}

export default function BillingPaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg">
        <h1 className="text-3xl font-semibold text-slate-900">Payment Received</h1>
        <p className="mt-4 text-slate-600">
          Thank you. DRU EDU is now finalizing the enrollment and parent portal access.
        </p>
        <p className="mt-2 text-slate-600">
          If this is your first parent portal payment, you will receive an invite email shortly.
        </p>
      </div>
    </div>
  );
}

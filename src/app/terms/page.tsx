import { Footer } from "@/components/ui";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-primary-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-lg text-gray-600 mb-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acceptance of Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing and using Dr. U Education's services, you accept and agree to be bound 
              by the terms and provision of this agreement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Use of Services</h2>
            <p className="text-gray-700 mb-4">
              Our educational services are provided for legitimate educational purposes. 
              You agree to use our platform responsibly and in accordance with our guidelines.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Payment Terms</h2>
            <p className="text-gray-700 mb-4">
              Payment for courses and services is due at the time of enrollment unless otherwise 
              specified. Refunds are available according to our refund policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              Dr. U Education shall not be liable for any indirect, incidental, special, 
              consequential, or punitive damages resulting from your use of our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
            <p className="text-gray-700">
              For questions regarding these terms, please contact us at 
              <a href="mailto:legal@drueducation.com" className="text-primary-600 hover:text-primary-700">
                legal@drueducation.com
              </a>
            </p>
          </section>
        </div>
      </div>
      
      <Footer variant="minimal" />
    </div>
  );
}

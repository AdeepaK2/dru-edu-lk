import { Footer } from "@/components/ui";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Account | Dr U Education",
  description: "Request deletion of your Dr U Education account and associated data.",
};

export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-primary-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Account Deletion Request</h1>

        <p className="text-lg text-gray-600 mb-10">
          Last updated: March 26, 2026
        </p>

        <div className="prose prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How to Delete Your Account</h2>
            <p className="text-gray-700 mb-4">
              If you wish to delete your Dr U Education account and all associated data, you can do so
              by sending a deletion request to our support team. We will process your request within
              30 days.
            </p>
            <p className="text-gray-700 mb-4">
              To request account deletion, please email us at{" "}
              <a href="mailto:info@drueducation.com" className="text-primary-600 hover:text-primary-700">
                info@drueducation.com
              </a>{" "}
              with the subject line <strong>&quot;Account Deletion Request&quot;</strong> and include:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Your full name</li>
              <li>The email address associated with your account</li>
              <li>Your role (Parent, Student, or Teacher)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Data Will Be Deleted</h2>
            <p className="text-gray-700 mb-3">Upon account deletion, the following data will be permanently removed:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Your account profile (name, email, phone number, profile photo)</li>
              <li>Student academic records (grades, test scores, attendance, homework)</li>
              <li>Chat messages and communications</li>
              <li>Class enrollment and scheduling information</li>
              <li>Push notification tokens and device information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Data May Be Retained</h2>
            <p className="text-gray-700 mb-3">
              Some data may be retained for legal or legitimate business purposes:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Transaction records:</strong> Subscription payment history is retained for up to 7 years for tax and accounting compliance under Australian law</li>
              <li><strong>Anonymised data:</strong> Aggregated, non-identifiable usage statistics may be retained for service improvement</li>
            </ul>
            <p className="text-gray-700 mt-4">
              All retained data is stored securely and used solely for the purposes stated above.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Partial Data Deletion</h2>
            <p className="text-gray-700">
              If you would like to delete specific data without deleting your entire account (such as
              chat history, profile photo, or test records), please contact us at{" "}
              <a href="mailto:info@drueducation.com" className="text-primary-600 hover:text-primary-700">
                info@drueducation.com
              </a>{" "}
              and specify which data you would like removed. We will process your request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700">
              For any questions regarding account or data deletion, please contact:{" "}
              <a href="mailto:info@drueducation.com" className="text-primary-600 hover:text-primary-700">
                info@drueducation.com
              </a>
            </p>
          </section>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  );
}

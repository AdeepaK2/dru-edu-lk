import { Footer } from "@/components/ui";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Dr U Education",
  description: "Privacy Policy for Dr U Education web and mobile applications.",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-primary-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>

        <p className="text-lg text-gray-600 mb-10">
          Last updated: March 28, 2026
        </p>

        <div className="prose prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700">
              Dr. U Education Pty Ltd (ABN/ACN as registered) (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
              operates the Dr U Education website and the Dr U Edu mobile application (together,
              the &quot;Services&quot;). This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our Services. By using our Services, you
              agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-medium text-gray-800 mb-3">2.1 Personal Information</h3>
            <p className="text-gray-700 mb-3">When you register for an account, we collect:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Profile photo (if provided)</li>
              <li>Student and parent/guardian relationship information</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-800 mb-3 mt-6">2.2 Educational Data</h3>
            <p className="text-gray-700 mb-3">In the course of using our Services, we collect:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Class enrolment and schedule information</li>
              <li>Test submissions, scores, and performance data</li>
              <li>Homework submissions and grades</li>
              <li>Attendance records</li>
              <li>Teacher&ndash;parent/student communications (chat messages)</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-800 mb-3 mt-6">2.3 Device and Usage Information</h3>
            <p className="text-gray-700 mb-3">We automatically collect:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Device type, model, and operating system</li>
              <li>Push notification tokens (for sending notifications)</li>
              <li>App usage patterns and interaction data</li>
              <li>IP address and general location data</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-800 mb-3 mt-6">2.4 Payment Information</h3>
            <p className="text-gray-700">
              Subscription payments are processed through Apple App Store and Google Play Store.
              We do not directly collect or store your credit card or payment details. Payment
              processing is handled entirely by Apple and Google under their respective privacy
              policies.
            </p>

            <h3 className="text-xl font-medium text-gray-800 mb-3 mt-6">2.5 Camera and Photo Library</h3>
            <p className="text-gray-700">
              Our mobile app may request access to your device&apos;s camera and photo library solely
              for the purpose of uploading profile photos, sharing images in teacher&ndash;parent chat,
              and submitting homework assignments. We do not access your camera or photos without your
              explicit permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-3">We use the collected information to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Provide, operate, and maintain our educational Services</li>
              <li>Create and manage your account</li>
              <li>Facilitate communication between teachers, parents, and students</li>
              <li>Track academic progress and generate performance reports</li>
              <li>Send push notifications about classes, tests, grades, and messages</li>
              <li>Process subscription payments and manage billing</li>
              <li>Improve and personalise the user experience</li>
              <li>Respond to customer support requests</li>
              <li>Ensure the security and integrity of our platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Storage and Security</h2>
            <p className="text-gray-700 mb-4">
              Your data is stored securely using Google Firebase services, including Cloud Firestore
              for application data, Firebase Authentication for account credentials, and Firebase
              Cloud Storage for uploaded files. All data is transmitted using industry-standard
              TLS/SSL encryption. Our servers are located in Australia where possible; some Firebase
              infrastructure may be hosted in other regions.
            </p>
            <p className="text-gray-700">
              We implement appropriate technical and organisational measures to protect your personal
              information against unauthorised access, alteration, disclosure, or destruction. However,
              no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Information Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-3">
              We do not sell, trade, or rent your personal information to third parties. We may
              share your information only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Teachers and educational staff:</strong> Academic data is shared with relevant teachers and administrators to facilitate education</li>
              <li><strong>Parents/guardians:</strong> Student academic performance and communications are accessible to linked parents or guardians</li>
              <li><strong>Service providers:</strong> We use third-party services (Google Firebase, Vercel, Apple, Google) to host and operate our platform</li>
              <li><strong>Legal requirements:</strong> We may disclose information if required by Australian law or in response to valid legal processes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Push Notifications</h2>
            <p className="text-gray-700">
              Our mobile app uses push notifications to alert you about new messages, test results,
              homework assignments, and other educational updates. You can manage your notification
              preferences within the app settings or through your device&apos;s system settings. You
              may opt out of push notifications at any time without affecting your use of the Services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
            <p className="text-gray-700">
              We retain your personal information for as long as your account is active or as needed
              to provide our Services. If you wish to delete your account, you may contact us at{" "}
              <a href="mailto:info@drueducation.com" className="text-primary-600 hover:text-primary-700">
                info@drueducation.com
              </a>{" "}
              and we will delete your personal data within a reasonable timeframe, except where we
              are required to retain it for legal or legitimate business purposes under Australian law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Children&apos;s Privacy</h2>
            <p className="text-gray-700">
              Our Services are designed for use by students, parents, and educators. Student accounts
              are created and managed by Dr U Education staff in conjunction with parents or guardians.
              We do not allow children to create accounts independently. All student data is accessible
              to their linked parent or guardian. If you believe personal information has been collected
              from a child without appropriate parental involvement, please contact us immediately at{" "}
              <a href="mailto:info@drueducation.com" className="text-primary-600 hover:text-primary-700">
                info@drueducation.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Australian Privacy Principles</h2>
            <p className="text-gray-700">
              We are committed to handling personal information in accordance with the Australian
              Privacy Principles (APPs) under the Privacy Act 1988 (Cth). You have the right to
              access and correct any personal information we hold about you. If you wish to make a
              complaint about how we handle your personal information, please contact us and we will
              respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Your Rights</h2>
            <p className="text-gray-700 mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of non-essential communications</li>
              <li>Withdraw consent for data processing where applicable</li>
              <li>Lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify you of any material
              changes by posting the updated policy on this page and updating the &quot;Last updated&quot;
              date. Your continued use of the Services after any changes constitutes acceptance of the
              updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions or concerns about this Privacy Policy or our data practices,
              please contact us:
            </p>
            <div className="text-gray-700 space-y-2">
              <p><strong>Dr. U Education Pty Ltd</strong></p>
              <p>
                <strong>Locations:</strong><br />
                63A High Street, Cranbourne, VIC<br />
                230/A Blackburn Road, Glen Waverley, VIC
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a href="mailto:info@drueducation.com" className="text-primary-600 hover:text-primary-700">
                  info@drueducation.com
                </a>
              </p>
              <p><strong>Phone:</strong> 0478 716 402</p>
              <p>Melbourne, Victoria, Australia</p>
            </div>
          </section>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  );
}

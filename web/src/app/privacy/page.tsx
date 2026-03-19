import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - Filteral",
  description: "Privacy policy for Filteral.app",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm mb-8 inline-block"
        >
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Privacy Policy
        </h1>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Introduction
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Filteral ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, and safeguard your information when you use our service at filteral.app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Information We Collect
            </h2>

            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-4 mb-2">
              Account Information
            </h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              When you create an account, we collect:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1 mt-2">
              <li>Email address</li>
              <li>Name (optional)</li>
              <li>Password (stored securely hashed)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-4 mb-2">
              Platform Connection Data
            </h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              When you connect third-party platforms, we collect:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1 mt-2">
              <li><strong>YouTube:</strong> Your channel subscriptions and public video metadata (titles, descriptions, thumbnails) via YouTube API Services</li>
              <li><strong>Bilibili:</strong> Your watch history and subscriptions (accessed via authenticated session)</li>
              <li><strong>Reddit & X:</strong> No personal data - we only access public content based on your interests</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-4 mb-2">
              User Preferences
            </h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We store your preferences including:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1 mt-2">
              <li>Interests and topics you specify</li>
              <li>Content preferences and settings</li>
              <li>AI-generated persona based on your viewing patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              How We Use Your Information
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We use collected information to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mt-3">
              <li>Generate personalized content recommendations</li>
              <li>Improve our recommendation algorithms</li>
              <li>Send you email notifications (if enabled)</li>
              <li>Provide customer support</li>
              <li>Maintain and improve our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Google API Services
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Our use of Google API Services (including YouTube Data API) complies with the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mt-3">
              We only access the minimum data necessary to provide recommendations. You can revoke
              our access at any time through your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Account settings
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Data Storage and Security
            </h2>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
              <li>Your data is stored on secure cloud servers (Google Cloud)</li>
              <li>Authentication tokens are encrypted at rest</li>
              <li>All data transfers use HTTPS encryption</li>
              <li>We do not sell or rent your personal data</li>
              <li>We do not share your data with third parties except as required to provide our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Data Retention
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We retain your data for as long as your account is active. When you delete your account:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1 mt-2">
              <li>All personal data is permanently deleted</li>
              <li>Connected platform tokens are revoked and deleted</li>
              <li>Recommendation history is deleted</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Your Rights
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mt-3">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct your information</li>
              <li><strong>Deletion:</strong> Delete your account and all associated data</li>
              <li><strong>Disconnect:</strong> Remove connected platforms at any time</li>
              <li><strong>Opt-out:</strong> Disable email notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Cookies
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We use essential cookies to maintain your login session. We do not use tracking
              or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Changes to This Policy
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any
              significant changes by email or through our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Contact Us
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a
                href="mailto:hello@filteral.app"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                hello@filteral.app
              </a>.
            </p>
          </section>

          <section className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Last updated: January 2025
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

export const metadata = {
  title: "Disclaimer - Filteral",
  description: "Disclaimer and terms for using Filteral.app",
};

export default function DisclaimerPage() {
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
          Disclaimer
        </h1>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              About Filteral
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Filteral.app is an AI-powered content recommendation platform that helps users discover
              personalized content from various video and social media platforms. Our service aggregates
              publicly available content and uses artificial intelligence to curate recommendations
              based on your preferences and viewing history.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Third-Party Platform Access
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Filteral integrates with third-party platforms including YouTube, Bilibili, Reddit, and X (Twitter).
              When you connect your accounts:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mt-3">
              <li>
                <strong>YouTube:</strong> We use YouTube API Services to access your subscriptions and
                provide recommendations. By using this feature, you agree to be bound by the
                <a href="https://www.youtube.com/t/terms" className="text-blue-600 dark:text-blue-400 hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                  YouTube Terms of Service
                </a>.
              </li>
              <li>
                <strong>Bilibili:</strong> We use browser automation to access your account data
                after you authenticate via QR code scan.
              </li>
              <li>
                <strong>Reddit & X:</strong> We access publicly available content based on your
                interests and keywords. No login is required for these platforms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Google API Services User Data Policy
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Filteral's use and transfer of information received from Google APIs adheres to the{" "}
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
              Specifically:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mt-3">
              <li>We only access data necessary to provide our recommendation service (your YouTube subscriptions and public video data).</li>
              <li>We do not sell, rent, or share your Google user data with third parties.</li>
              <li>We do not use Google user data for advertising purposes.</li>
              <li>We store your access tokens securely and encrypted.</li>
              <li>You can revoke access at any time by disconnecting YouTube in your account settings or via your Google Account permissions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Data Storage and Security
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We take data security seriously:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mt-3">
              <li>Authentication tokens are stored encrypted in our database.</li>
              <li>We use secure HTTPS connections for all data transfers.</li>
              <li>Your personal data is not shared with third parties except as required to provide our services.</li>
              <li>You can delete your account and all associated data at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              AI-Generated Content
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Our recommendation explanations are generated using AI (OpenAI GPT models). While we strive
              for accuracy, these explanations are meant to help you understand why content was recommended
              and may not always perfectly capture the nuances of the content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Limitation of Liability
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Filteral is provided "as is" without warranties of any kind. We are not responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mt-3">
              <li>The content of third-party platforms that we recommend.</li>
              <li>Any interruptions in service from third-party platforms.</li>
              <li>Changes to third-party platform APIs that may affect our service.</li>
              <li>Any actions taken based on our recommendations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Contact Us
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              If you have any questions about this disclaimer or our services, please contact us at{" "}
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

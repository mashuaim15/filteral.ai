import Link from "next/link";

export const metadata = {
  title: "Terms of Service - Filteral",
  description: "Terms of service for Filteral.app",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Agreement to Terms
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              By accessing or using Filteral.app ("Service"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Description of Service
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Filteral is an AI-powered content recommendation platform that aggregates and curates
              content from various video and social media platforms based on your preferences and
              connected accounts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              User Accounts
            </h2>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
              <li>You must provide accurate information when creating an account</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must be at least 13 years old to use this Service</li>
              <li>One account per person; sharing accounts is not permitted</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Third-Party Platforms
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Our Service integrates with third-party platforms. When you connect these platforms:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mt-3">
              <li>You must comply with each platform's terms of service</li>
              <li>We are not responsible for content from third-party platforms</li>
              <li>Platform availability may change without notice</li>
              <li>Your use of YouTube data is subject to the <a href="https://www.youtube.com/t/terms" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Acceptable Use
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mt-3">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Use automated tools to access the Service (except as permitted)</li>
              <li>Violate any third-party platform's terms of service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Subscription and Payments
            </h2>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
              <li>Free tier is available with limited features</li>
              <li>Paid subscriptions are billed in advance</li>
              <li>Refunds are provided at our discretion</li>
              <li>We reserve the right to change pricing with notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Intellectual Property
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              The Service and its original content (excluding user-connected content and third-party
              content) are owned by Filteral and protected by copyright and other intellectual
              property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Disclaimer of Warranties
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE
              THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Limitation of Liability
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FILTERAL SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM
              YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Termination
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We may terminate or suspend your account at any time for violations of these terms.
              You may delete your account at any time. Upon termination, your data will be deleted
              in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Changes to Terms
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users of
              significant changes. Continued use of the Service after changes constitutes
              acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Contact
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              For questions about these Terms, contact us at{" "}
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

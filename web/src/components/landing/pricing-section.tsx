import Link from "next/link";

const checkIcon = (
  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export function PricingSection() {
  return (
    <section className="py-16 border-t border-gray-100 dark:border-gray-800">
      <h2 className="text-2xl font-semibold text-center mb-4 text-gray-900 dark:text-white">
        Simple pricing
      </h2>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-10">
        Start free. Upgrade when you want a smarter AI included.
      </p>

      <div className="max-w-2xl mx-auto grid sm:grid-cols-2 gap-6">
        {/* PRO — Free */}
        <div className="p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center flex flex-col">
          <h3 className="text-lg font-medium mb-1 text-gray-900 dark:text-white">Pro</h3>
          <div className="mb-6">
            <span className="text-4xl font-semibold text-gray-900 dark:text-white">$0</span>
            <span className="text-sm text-gray-500 dark:text-gray-400"> / forever</span>
          </div>
          <ul className="space-y-2 mb-8 text-left flex-1">
            {[
              "Up to 30 recommendations per day",
              "All platforms (YouTube, Bilibili, Reddit, X)",
              "AI-powered personalized selections",
              "Bring your own API key (optional)",
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {checkIcon}
                {feature}
              </li>
            ))}
          </ul>
          <Link href="/register">
            <button className="w-full px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Get started — it&apos;s free
            </button>
          </Link>
        </div>

        {/* MAX — Paid */}
        <div className="p-8 rounded-lg border-2 border-gray-900 dark:border-white text-center flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Max</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900">
              Best
            </span>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-semibold text-gray-900 dark:text-white">$1.99</span>
            <span className="text-sm text-gray-500 dark:text-gray-400"> / month</span>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">or $15 / year</p>
          </div>
          <ul className="space-y-2 mb-8 text-left flex-1">
            {[
              "claude-sonnet-4-6 included — no API key needed",
              "Up to 30 recommendations per day",
              "All platforms (YouTube, Bilibili, Reddit, X)",
              "Email delivery",
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {checkIcon}
                {feature}
              </li>
            ))}
          </ul>
          <a href="mailto:hello@filteral.app?subject=Max+Membership">
            <button className="w-full px-4 py-2 text-sm font-medium rounded-md bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors">
              Get started
            </button>
          </a>
        </div>
      </div>
    </section>
  );
}
